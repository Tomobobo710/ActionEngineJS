//! Glow-based OpenGL renderer using modern OpenGL with batching

use crate::{Color, Image, LinearGradient, Pos2, Rect, Renderer, Stroke, TextStyle, Vec2};
use glow::HasContext;

// Batched shader with per-vertex colors
const BATCHED_VERTEX_SHADER: &str = r#"
#version 100
attribute vec2 a_pos;
attribute vec4 a_color;
varying vec4 v_color;

void main() {
    gl_Position = vec4(a_pos, 0.0, 1.0);
    v_color = a_color;
}
"#;

const BATCHED_FRAGMENT_SHADER: &str = r#"
#version 100
precision mediump float;
varying vec4 v_color;

void main() {
    gl_FragColor = v_color;
}
"#;

// Shader for textured quads (images)
const TEXTURE_VERTEX_SHADER: &str = r#"
#version 100
attribute vec2 a_pos;
attribute vec2 a_uv;
varying vec2 v_uv;

void main() {
    gl_Position = vec4(a_pos, 0.0, 1.0);
    v_uv = a_uv;
}
"#;

const TEXTURE_FRAGMENT_SHADER: &str = r#"
#version 100
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_texture;

void main() {
    gl_FragColor = texture2D(u_texture, v_uv);
}
"#;

/// A 2D transform matrix (3x3 stored as 6 values: a, b, c, d, tx, ty)
#[derive(Clone, Copy)]
struct Transform2D {
    a: f32,  // scale x
    b: f32,  // skew y
    c: f32,  // skew x
    d: f32,  // scale y
    tx: f32, // translate x
    ty: f32, // translate y
}

impl Default for Transform2D {
    fn default() -> Self {
        Self::identity()
    }
}

impl Transform2D {
    fn identity() -> Self {
        Self {
            a: 1.0,
            b: 0.0,
            c: 0.0,
            d: 1.0,
            tx: 0.0,
            ty: 0.0,
        }
    }

    fn translate(&self, x: f32, y: f32) -> Self {
        Self {
            a: self.a,
            b: self.b,
            c: self.c,
            d: self.d,
            tx: self.tx + self.a * x + self.c * y,
            ty: self.ty + self.b * x + self.d * y,
        }
    }

    fn rotate(&self, angle: f32) -> Self {
        let cos = angle.cos();
        let sin = angle.sin();
        Self {
            a: self.a * cos + self.c * sin,
            b: self.b * cos + self.d * sin,
            c: self.c * cos - self.a * sin,
            d: self.d * cos - self.b * sin,
            tx: self.tx,
            ty: self.ty,
        }
    }

    fn scale(&self, sx: f32, sy: f32) -> Self {
        Self {
            a: self.a * sx,
            b: self.b * sx,
            c: self.c * sy,
            d: self.d * sy,
            tx: self.tx,
            ty: self.ty,
        }
    }

    fn transform_point(&self, x: f32, y: f32) -> (f32, f32) {
        (
            self.a * x + self.c * y + self.tx,
            self.b * x + self.d * y + self.ty,
        )
    }
}

/// Path command for building paths
#[derive(Clone)]
enum PathCommand {
    MoveTo(f32, f32),
    LineTo(f32, f32),
    Arc {
        cx: f32,
        cy: f32,
        radius: f32,
        start_angle: f32,
        end_angle: f32,
    },
    Close,
}

/// OpenGL renderer using glow with batching for performance
pub struct GlowRenderer {
    gl: glow::Context,
    // Batched shader (per-vertex colors)
    program: glow::Program,
    vbo: glow::Buffer,
    vao: glow::VertexArray,
    // Texture shader
    texture_program: glow::Program,
    texture_vbo: glow::Buffer,
    texture_vao: glow::VertexArray,
    // Dimensions
    game_width: f32,
    game_height: f32,
    window_width: f32,
    window_height: f32,
    viewport_x: i32,
    viewport_y: i32,
    viewport_w: i32,
    viewport_h: i32,
    // Transform state
    transform_stack: Vec<Transform2D>,
    current_transform: Transform2D,
    // Path state
    current_path: Vec<PathCommand>,
    // Batched vertices: [x, y, r, g, b, a] per vertex
    triangle_batch: Vec<f32>,
    line_batch: Vec<f32>,
}

impl GlowRenderer {
    pub fn new(gl: glow::Context, game_width: u32, game_height: u32) -> Self {
        unsafe {
            // Helper to create shader program
            let create_program = |vs_src: &str, fs_src: &str| -> glow::Program {
                let program = gl.create_program().expect("Cannot create program");
                let shader_sources = [
                    (glow::VERTEX_SHADER, vs_src),
                    (glow::FRAGMENT_SHADER, fs_src),
                ];
                let mut shaders = Vec::new();
                for (shader_type, source) in shader_sources {
                    let shader = gl.create_shader(shader_type).expect("Cannot create shader");
                    gl.shader_source(shader, source);
                    gl.compile_shader(shader);
                    if !gl.get_shader_compile_status(shader) {
                        panic!("Shader compile error: {}", gl.get_shader_info_log(shader));
                    }
                    gl.attach_shader(program, shader);
                    shaders.push(shader);
                }
                gl.link_program(program);
                if !gl.get_program_link_status(program) {
                    panic!("Program link error: {}", gl.get_program_info_log(program));
                }
                for shader in shaders {
                    gl.detach_shader(program, shader);
                    gl.delete_shader(shader);
                }
                program
            };

            // Create batched shader program (per-vertex colors)
            let program = create_program(BATCHED_VERTEX_SHADER, BATCHED_FRAGMENT_SHADER);

            // Create VAO and VBO for batched rendering
            let vao = gl.create_vertex_array().expect("Cannot create VAO");
            let vbo = gl.create_buffer().expect("Cannot create VBO");
            gl.bind_vertex_array(Some(vao));
            gl.bind_buffer(glow::ARRAY_BUFFER, Some(vbo));
            // Vertex format: x, y, r, g, b, a (6 floats = 24 bytes)
            let pos_loc = gl.get_attrib_location(program, "a_pos").unwrap();
            let color_loc = gl.get_attrib_location(program, "a_color").unwrap();
            gl.enable_vertex_attrib_array(pos_loc);
            gl.enable_vertex_attrib_array(color_loc);
            gl.vertex_attrib_pointer_f32(pos_loc, 2, glow::FLOAT, false, 24, 0);
            gl.vertex_attrib_pointer_f32(color_loc, 4, glow::FLOAT, false, 24, 8);
            gl.bind_vertex_array(None);

            // Create texture shader program
            let texture_program = create_program(TEXTURE_VERTEX_SHADER, TEXTURE_FRAGMENT_SHADER);
            let texture_vao = gl.create_vertex_array().expect("Cannot create texture VAO");
            let texture_vbo = gl.create_buffer().expect("Cannot create texture VBO");
            gl.bind_vertex_array(Some(texture_vao));
            gl.bind_buffer(glow::ARRAY_BUFFER, Some(texture_vbo));
            // Vertex format: x, y, u, v (4 floats = 16 bytes)
            let tex_pos_loc = gl.get_attrib_location(texture_program, "a_pos").unwrap();
            let tex_uv_loc = gl.get_attrib_location(texture_program, "a_uv").unwrap();
            gl.enable_vertex_attrib_array(tex_pos_loc);
            gl.enable_vertex_attrib_array(tex_uv_loc);
            gl.vertex_attrib_pointer_f32(tex_pos_loc, 2, glow::FLOAT, false, 16, 0);
            gl.vertex_attrib_pointer_f32(tex_uv_loc, 2, glow::FLOAT, false, 16, 8);
            gl.bind_vertex_array(None);

            // Enable blending
            gl.enable(glow::BLEND);
            gl.blend_func(glow::SRC_ALPHA, glow::ONE_MINUS_SRC_ALPHA);

            let mut renderer = Self {
                gl,
                program,
                vbo,
                vao,
                texture_program,
                texture_vbo,
                texture_vao,
                game_width: game_width as f32,
                game_height: game_height as f32,
                window_width: game_width as f32,
                window_height: game_height as f32,
                viewport_x: 0,
                viewport_y: 0,
                viewport_w: game_width as i32,
                viewport_h: game_height as i32,
                transform_stack: Vec::new(),
                current_transform: Transform2D::identity(),
                current_path: Vec::new(),
                triangle_batch: Vec::with_capacity(10000),
                line_batch: Vec::with_capacity(5000),
            };
            renderer.update_viewport(game_width, game_height);
            renderer
        }
    }

    /// Update the window size and recalculate viewport
    pub fn update_viewport(&mut self, window_width: u32, window_height: u32) {
        self.window_width = window_width as f32;
        self.window_height = window_height as f32;

        let window_aspect = self.window_width / self.window_height;
        let game_aspect = self.game_width / self.game_height;

        if window_aspect > game_aspect {
            self.viewport_h = window_height as i32;
            self.viewport_w = (window_height as f32 * game_aspect) as i32;
            self.viewport_x = ((window_width as i32) - self.viewport_w) / 2;
            self.viewport_y = 0;
        } else {
            self.viewport_w = window_width as i32;
            self.viewport_h = (window_width as f32 / game_aspect) as i32;
            self.viewport_x = 0;
            self.viewport_y = ((window_height as i32) - self.viewport_h) / 2;
        }
    }

    fn to_ndc(&self, pos: Pos2) -> (f32, f32) {
        let (tx, ty) = self.current_transform.transform_point(pos.x, pos.y);
        let x = (tx / self.game_width) * 2.0 - 1.0;
        let y = 1.0 - (ty / self.game_height) * 2.0;
        (x, y)
    }

    fn to_ndc_raw(&self, x: f32, y: f32) -> (f32, f32) {
        let (tx, ty) = self.current_transform.transform_point(x, y);
        let nx = (tx / self.game_width) * 2.0 - 1.0;
        let ny = 1.0 - (ty / self.game_height) * 2.0;
        (nx, ny)
    }

    fn size_to_ndc(&self, size: Vec2) -> (f32, f32) {
        let w = (size.x * self.current_transform.a.abs() / self.game_width) * 2.0;
        let h = (size.y * self.current_transform.d.abs() / self.game_height) * 2.0;
        (w, h)
    }

    fn color_to_floats(color: Color) -> [f32; 4] {
        [
            color.r as f32 / 255.0,
            color.g as f32 / 255.0,
            color.b as f32 / 255.0,
            color.a as f32 / 255.0,
        ]
    }

    fn flatten_path(&self) -> Vec<(f32, f32)> {
        const ARC_SEGMENTS: usize = 16;
        let mut points = Vec::new();

        for cmd in &self.current_path {
            match cmd {
                PathCommand::MoveTo(x, y) => {
                    points.push((*x, *y));
                }
                PathCommand::LineTo(x, y) => {
                    points.push((*x, *y));
                }
                PathCommand::Arc {
                    cx,
                    cy,
                    radius,
                    start_angle,
                    end_angle,
                } => {
                    let angle_range = end_angle - start_angle;
                    for i in 0..=ARC_SEGMENTS {
                        let t = i as f32 / ARC_SEGMENTS as f32;
                        let angle = start_angle + t * angle_range;
                        let x = cx + angle.cos() * radius;
                        let y = cy + angle.sin() * radius;
                        points.push((x, y));
                    }
                }
                PathCommand::Close => {
                    if let Some(&first) = points.first() {
                        points.push(first);
                    }
                }
            }
        }
        points
    }

    /// Add a triangle to the batch
    fn batch_triangle(&mut self, p1: (f32, f32), p2: (f32, f32), p3: (f32, f32), color: [f32; 4]) {
        // Vertex 1
        self.triangle_batch.extend_from_slice(&[p1.0, p1.1, color[0], color[1], color[2], color[3]]);
        // Vertex 2
        self.triangle_batch.extend_from_slice(&[p2.0, p2.1, color[0], color[1], color[2], color[3]]);
        // Vertex 3
        self.triangle_batch.extend_from_slice(&[p3.0, p3.1, color[0], color[1], color[2], color[3]]);
    }

    /// Add a line segment to the batch
    fn batch_line(&mut self, p1: (f32, f32), p2: (f32, f32), color: [f32; 4]) {
        self.line_batch.extend_from_slice(&[p1.0, p1.1, color[0], color[1], color[2], color[3]]);
        self.line_batch.extend_from_slice(&[p2.0, p2.1, color[0], color[1], color[2], color[3]]);
    }

    pub fn begin_frame(&mut self) {
        // Clear batches
        self.triangle_batch.clear();
        self.line_batch.clear();

        unsafe {
            // Clear entire window to black
            self.gl.viewport(0, 0, self.window_width as i32, self.window_height as i32);
            self.gl.clear_color(0.0, 0.0, 0.0, 1.0);
            self.gl.clear(glow::COLOR_BUFFER_BIT);

            // Set viewport to game area
            self.gl.viewport(self.viewport_x, self.viewport_y, self.viewport_w, self.viewport_h);
        }
    }

    /// Flush all batched geometry to the GPU
    pub fn end_frame(&mut self) {
        unsafe {
            self.gl.use_program(Some(self.program));
            self.gl.bind_vertex_array(Some(self.vao));
            self.gl.bind_buffer(glow::ARRAY_BUFFER, Some(self.vbo));

            // Draw triangles
            if !self.triangle_batch.is_empty() {
                self.gl.buffer_data_u8_slice(
                    glow::ARRAY_BUFFER,
                    bytemuck::cast_slice(&self.triangle_batch),
                    glow::STREAM_DRAW,
                );
                self.gl.draw_arrays(glow::TRIANGLES, 0, (self.triangle_batch.len() / 6) as i32);
            }

            // Draw lines (reuse same buffer)
            if !self.line_batch.is_empty() {
                self.gl.buffer_data_u8_slice(
                    glow::ARRAY_BUFFER,
                    bytemuck::cast_slice(&self.line_batch),
                    glow::STREAM_DRAW,
                );
                self.gl.draw_arrays(glow::LINES, 0, (self.line_batch.len() / 6) as i32);
            }

            self.gl.bind_vertex_array(None);
        }
    }

    pub fn gl(&self) -> &glow::Context {
        &self.gl
    }

    /// Helper to draw a text texture (internal use)
    fn draw_text_texture(&mut self, rgba: &[u8], tex_w: u32, tex_h: u32, pos: Pos2, draw_w: f32, draw_h: f32) {
        // Flush current batches before drawing texture
        self.end_frame();
        self.triangle_batch.clear();
        self.line_batch.clear();

        unsafe {
            // Create texture
            let texture = self.gl.create_texture().expect("Cannot create texture");
            self.gl.bind_texture(glow::TEXTURE_2D, Some(texture));
            self.gl.tex_parameter_i32(glow::TEXTURE_2D, glow::TEXTURE_MIN_FILTER, glow::LINEAR as i32);
            self.gl.tex_parameter_i32(glow::TEXTURE_2D, glow::TEXTURE_MAG_FILTER, glow::LINEAR as i32);
            self.gl.tex_parameter_i32(glow::TEXTURE_2D, glow::TEXTURE_WRAP_S, glow::CLAMP_TO_EDGE as i32);
            self.gl.tex_parameter_i32(glow::TEXTURE_2D, glow::TEXTURE_WRAP_T, glow::CLAMP_TO_EDGE as i32);

            self.gl.tex_image_2d(
                glow::TEXTURE_2D,
                0,
                glow::RGBA as i32,
                tex_w as i32,
                tex_h as i32,
                0,
                glow::RGBA,
                glow::UNSIGNED_BYTE,
                glow::PixelUnpackData::Slice(Some(rgba)),
            );

            // Calculate NDC coordinates
            let rect = Rect::from_min_size(pos, Vec2::new(draw_w, draw_h));
            let (x1, y1) = self.to_ndc(rect.min);
            let (w, h) = self.size_to_ndc(rect.size());
            let x2 = x1 + w;
            let y2 = y1 - h;

            #[rustfmt::skip]
            let vertices: [f32; 24] = [
                x1, y1, 0.0, 0.0,
                x2, y1, 1.0, 0.0,
                x2, y2, 1.0, 1.0,
                x1, y1, 0.0, 0.0,
                x2, y2, 1.0, 1.0,
                x1, y2, 0.0, 1.0,
            ];

            self.gl.use_program(Some(self.texture_program));
            self.gl.bind_vertex_array(Some(self.texture_vao));
            self.gl.bind_buffer(glow::ARRAY_BUFFER, Some(self.texture_vbo));
            self.gl.buffer_data_u8_slice(
                glow::ARRAY_BUFFER,
                bytemuck::cast_slice(&vertices),
                glow::STREAM_DRAW,
            );
            self.gl.draw_arrays(glow::TRIANGLES, 0, 6);
            self.gl.bind_vertex_array(None);

            // Clean up texture
            self.gl.delete_texture(texture);
        }
    }
}

impl Renderer for GlowRenderer {
    fn clear(&mut self, color: Color) {
        unsafe {
            self.gl.clear_color(
                color.r as f32 / 255.0,
                color.g as f32 / 255.0,
                color.b as f32 / 255.0,
                color.a as f32 / 255.0,
            );
            self.gl.clear(glow::COLOR_BUFFER_BIT);
        }
    }

    fn fill_rect(&mut self, rect: Rect, color: Color) {
        let (x1, y1) = self.to_ndc(rect.min);
        let (w, h) = self.size_to_ndc(rect.size());
        let x2 = x1 + w;
        let y2 = y1 - h;
        let c = Self::color_to_floats(color);

        // Two triangles
        self.batch_triangle((x1, y1), (x2, y1), (x2, y2), c);
        self.batch_triangle((x1, y1), (x2, y2), (x1, y2), c);
    }

    fn stroke_rect(&mut self, rect: Rect, stroke: Stroke) {
        let (x1, y1) = self.to_ndc(rect.min);
        let (w, h) = self.size_to_ndc(rect.size());
        let x2 = x1 + w;
        let y2 = y1 - h;
        let c = Self::color_to_floats(stroke.color);

        // Four lines
        self.batch_line((x1, y1), (x2, y1), c);
        self.batch_line((x2, y1), (x2, y2), c);
        self.batch_line((x2, y2), (x1, y2), c);
        self.batch_line((x1, y2), (x1, y1), c);
    }

    fn fill_circle(&mut self, center: Pos2, radius: f32, color: Color) {
        const SEGMENTS: usize = 24; // Reduced from 32 for performance
        let (cx, cy) = self.to_ndc(center);
        let (rx, ry) = self.size_to_ndc(Vec2::new(radius, radius));
        let c = Self::color_to_floats(color);

        // Triangle fan as individual triangles
        for i in 0..SEGMENTS {
            let a1 = (i as f32 / SEGMENTS as f32) * std::f32::consts::TAU;
            let a2 = ((i + 1) as f32 / SEGMENTS as f32) * std::f32::consts::TAU;
            let p1 = (cx + a1.cos() * rx, cy + a1.sin() * ry);
            let p2 = (cx + a2.cos() * rx, cy + a2.sin() * ry);
            self.batch_triangle((cx, cy), p1, p2, c);
        }
    }

    fn stroke_circle(&mut self, center: Pos2, radius: f32, stroke: Stroke) {
        const SEGMENTS: usize = 24;
        let (cx, cy) = self.to_ndc(center);
        let (rx, ry) = self.size_to_ndc(Vec2::new(radius, radius));
        let c = Self::color_to_floats(stroke.color);

        for i in 0..SEGMENTS {
            let a1 = (i as f32 / SEGMENTS as f32) * std::f32::consts::TAU;
            let a2 = ((i + 1) as f32 / SEGMENTS as f32) * std::f32::consts::TAU;
            let p1 = (cx + a1.cos() * rx, cy + a1.sin() * ry);
            let p2 = (cx + a2.cos() * rx, cy + a2.sin() * ry);
            self.batch_line(p1, p2, c);
        }
    }

    fn draw_line(&mut self, from: Pos2, to: Pos2, stroke: Stroke) {
        let p1 = self.to_ndc(from);
        let p2 = self.to_ndc(to);
        let c = Self::color_to_floats(stroke.color);
        self.batch_line(p1, p2, c);
    }

    // === Path API ===

    fn begin_path(&mut self) {
        self.current_path.clear();
    }

    fn move_to(&mut self, pos: Pos2) {
        self.current_path.push(PathCommand::MoveTo(pos.x, pos.y));
    }

    fn line_to(&mut self, pos: Pos2) {
        self.current_path.push(PathCommand::LineTo(pos.x, pos.y));
    }

    fn arc(&mut self, center: Pos2, radius: f32, start_angle: f32, end_angle: f32) {
        self.current_path.push(PathCommand::Arc {
            cx: center.x,
            cy: center.y,
            radius,
            start_angle,
            end_angle,
        });
    }

    fn close_path(&mut self) {
        self.current_path.push(PathCommand::Close);
    }

    fn fill_path(&mut self, color: Color) {
        let points = self.flatten_path();
        if points.len() < 3 {
            return;
        }

        // Calculate centroid for proper triangulation of concave shapes
        let mut cx = 0.0;
        let mut cy = 0.0;
        for (x, y) in &points {
            cx += x;
            cy += y;
        }
        cx /= points.len() as f32;
        cy /= points.len() as f32;

        let center = self.to_ndc_raw(cx, cy);
        let c = Self::color_to_floats(color);

        // Triangulate from centroid
        for i in 0..points.len() {
            let p1 = self.to_ndc_raw(points[i].0, points[i].1);
            let p2_idx = (i + 1) % points.len();
            let p2 = self.to_ndc_raw(points[p2_idx].0, points[p2_idx].1);
            self.batch_triangle(center, p1, p2, c);
        }
    }

    fn stroke_path(&mut self, stroke: Stroke) {
        let points = self.flatten_path();
        if points.len() < 2 {
            return;
        }

        let c = Self::color_to_floats(stroke.color);

        for i in 0..points.len() - 1 {
            let p1 = self.to_ndc_raw(points[i].0, points[i].1);
            let p2 = self.to_ndc_raw(points[i + 1].0, points[i + 1].1);
            self.batch_line(p1, p2, c);
        }
    }

    // === Transform API ===

    fn save(&mut self) {
        self.transform_stack.push(self.current_transform);
    }

    fn restore(&mut self) {
        if let Some(t) = self.transform_stack.pop() {
            self.current_transform = t;
        }
    }

    fn translate(&mut self, offset: Vec2) {
        self.current_transform = self.current_transform.translate(offset.x, offset.y);
    }

    fn rotate(&mut self, angle: f32) {
        self.current_transform = self.current_transform.rotate(angle);
    }

    fn scale(&mut self, scale: Vec2) {
        self.current_transform = self.current_transform.scale(scale.x, scale.y);
    }

    // === Image API ===

    fn draw_image(&mut self, image: &Image, pos: Pos2) {
        let rect = Rect::from_min_size(pos, Vec2::new(image.width as f32, image.height as f32));
        self.draw_image_rect(image, rect);
    }

    fn draw_image_rect(&mut self, image: &Image, rect: Rect) {
        // Flush current batches before drawing image (different shader)
        self.end_frame();
        self.triangle_batch.clear();
        self.line_batch.clear();

        unsafe {
            // Create texture
            let texture = self.gl.create_texture().expect("Cannot create texture");
            self.gl.bind_texture(glow::TEXTURE_2D, Some(texture));
            self.gl.tex_parameter_i32(
                glow::TEXTURE_2D,
                glow::TEXTURE_MIN_FILTER,
                glow::LINEAR as i32,
            );
            self.gl.tex_parameter_i32(
                glow::TEXTURE_2D,
                glow::TEXTURE_MAG_FILTER,
                glow::LINEAR as i32,
            );
            self.gl.tex_parameter_i32(
                glow::TEXTURE_2D,
                glow::TEXTURE_WRAP_S,
                glow::CLAMP_TO_EDGE as i32,
            );
            self.gl.tex_parameter_i32(
                glow::TEXTURE_2D,
                glow::TEXTURE_WRAP_T,
                glow::CLAMP_TO_EDGE as i32,
            );

            self.gl.tex_image_2d(
                glow::TEXTURE_2D,
                0,
                glow::RGBA as i32,
                image.width as i32,
                image.height as i32,
                0,
                glow::RGBA,
                glow::UNSIGNED_BYTE,
                glow::PixelUnpackData::Slice(Some(&image.data[..])),
            );

            // Draw textured quad
            let (x1, y1) = self.to_ndc(rect.min);
            let (w, h) = self.size_to_ndc(rect.size());
            let x2 = x1 + w;
            let y2 = y1 - h;

            #[rustfmt::skip]
            let vertices: [f32; 24] = [
                x1, y1, 0.0, 0.0,
                x2, y1, 1.0, 0.0,
                x2, y2, 1.0, 1.0,
                x1, y1, 0.0, 0.0,
                x2, y2, 1.0, 1.0,
                x1, y2, 0.0, 1.0,
            ];

            self.gl.use_program(Some(self.texture_program));
            self.gl.bind_vertex_array(Some(self.texture_vao));
            self.gl.bind_buffer(glow::ARRAY_BUFFER, Some(self.texture_vbo));
            self.gl.buffer_data_u8_slice(
                glow::ARRAY_BUFFER,
                bytemuck::cast_slice(&vertices),
                glow::STREAM_DRAW,
            );
            self.gl.draw_arrays(glow::TRIANGLES, 0, 6);
            self.gl.bind_vertex_array(None);

            // Clean up texture
            self.gl.delete_texture(texture);
        }
    }

    // === Gradient API ===

    fn fill_rect_gradient(&mut self, rect: Rect, gradient: &LinearGradient) {
        let (x1, y1) = self.to_ndc(rect.min);
        let (w, h) = self.size_to_ndc(rect.size());
        let x2 = x1 + w;
        let y2 = y1 - h;

        // Calculate gradient direction
        let gx1 = gradient.start.x;
        let gy1 = gradient.start.y;
        let gx2 = gradient.end.x;
        let gy2 = gradient.end.y;
        let gdx = gx2 - gx1;
        let gdy = gy2 - gy1;
        let glen = (gdx * gdx + gdy * gdy).sqrt().max(0.001);

        let lerp_color = |px: f32, py: f32| -> [f32; 4] {
            let t = ((px - gx1) * gdx + (py - gy1) * gdy) / (glen * glen);
            let t = t.clamp(0.0, 1.0);
            [
                gradient.start_color.r as f32 / 255.0
                    + t * (gradient.end_color.r as f32 / 255.0 - gradient.start_color.r as f32 / 255.0),
                gradient.start_color.g as f32 / 255.0
                    + t * (gradient.end_color.g as f32 / 255.0 - gradient.start_color.g as f32 / 255.0),
                gradient.start_color.b as f32 / 255.0
                    + t * (gradient.end_color.b as f32 / 255.0 - gradient.start_color.b as f32 / 255.0),
                gradient.start_color.a as f32 / 255.0
                    + t * (gradient.end_color.a as f32 / 255.0 - gradient.start_color.a as f32 / 255.0),
            ]
        };

        let c_tl = lerp_color(0.0, 0.0);
        let c_tr = lerp_color(1.0, 0.0);
        let c_bl = lerp_color(0.0, 1.0);
        let c_br = lerp_color(1.0, 1.0);

        // Triangle 1 (top-left, top-right, bottom-right)
        self.triangle_batch.extend_from_slice(&[x1, y1, c_tl[0], c_tl[1], c_tl[2], c_tl[3]]);
        self.triangle_batch.extend_from_slice(&[x2, y1, c_tr[0], c_tr[1], c_tr[2], c_tr[3]]);
        self.triangle_batch.extend_from_slice(&[x2, y2, c_br[0], c_br[1], c_br[2], c_br[3]]);
        // Triangle 2 (top-left, bottom-right, bottom-left)
        self.triangle_batch.extend_from_slice(&[x1, y1, c_tl[0], c_tl[1], c_tl[2], c_tl[3]]);
        self.triangle_batch.extend_from_slice(&[x2, y2, c_br[0], c_br[1], c_br[2], c_br[3]]);
        self.triangle_batch.extend_from_slice(&[x1, y2, c_bl[0], c_bl[1], c_bl[2], c_bl[3]]);
    }

    // === Text API ===

    fn draw_text(&mut self, text: &str, pos: Pos2, style: &TextStyle<'_>) {
        if text.is_empty() {
            return;
        }

        // Measure and rasterize all glyphs
        let mut glyphs: Vec<(fontdue::Metrics, Vec<u8>)> = Vec::with_capacity(text.len());
        let mut total_width = 0.0f32;
        let mut max_height = 0u32;
        let mut max_ascent = 0i32; // Distance from top to baseline

        for ch in text.chars() {
            let (metrics, bitmap) = style.font.rasterize(ch, style.size);
            total_width += metrics.advance_width;
            max_height = max_height.max(metrics.height as u32);
            // ymin is negative for characters that go above baseline
            max_ascent = max_ascent.max(metrics.height as i32 + metrics.ymin);
            glyphs.push((metrics, bitmap));
        }

        if total_width <= 0.0 || max_height == 0 {
            return;
        }

        // Create RGBA buffer for the entire text
        let tex_width = total_width.ceil() as u32;
        let tex_height = (style.size * 1.2).ceil() as u32; // Add some padding for descenders
        let mut rgba = vec![0u8; (tex_width * tex_height * 4) as usize];

        // Composite each glyph into the buffer
        let mut cursor_x = 0.0f32;
        let baseline_y = max_ascent as f32;

        for (metrics, bitmap) in &glyphs {
            if bitmap.is_empty() {
                cursor_x += metrics.advance_width;
                continue;
            }

            // Calculate position for this glyph
            let glyph_x = cursor_x + metrics.xmin as f32;
            let glyph_y = baseline_y - metrics.height as f32 - metrics.ymin as f32;

            // Copy glyph bitmap into RGBA buffer
            for gy in 0..metrics.height {
                for gx in 0..metrics.width {
                    let src_idx = gy * metrics.width + gx;
                    let alpha = bitmap[src_idx];
                    if alpha == 0 {
                        continue;
                    }

                    let dst_x = (glyph_x + gx as f32) as i32;
                    let dst_y = (glyph_y + gy as f32) as i32;

                    if dst_x >= 0 && dst_x < tex_width as i32 && dst_y >= 0 && dst_y < tex_height as i32 {
                        let dst_idx = ((dst_y as u32 * tex_width + dst_x as u32) * 4) as usize;
                        // Premultiplied alpha with text color
                        let a = alpha as f32 / 255.0;
                        rgba[dst_idx] = (style.color.r as f32 * a) as u8;
                        rgba[dst_idx + 1] = (style.color.g as f32 * a) as u8;
                        rgba[dst_idx + 2] = (style.color.b as f32 * a) as u8;
                        rgba[dst_idx + 3] = alpha;
                    }
                }
            }

            cursor_x += metrics.advance_width;
        }

        // Draw the text texture
        self.draw_text_texture(&rgba, tex_width, tex_height, pos, total_width, tex_height as f32);
    }

    fn measure_text(&self, text: &str, style: &TextStyle<'_>) -> Vec2 {
        let width = style.font.measure_width(text, style.size);
        let height = style.size * 1.2; // Approximate line height
        Vec2::new(width, height)
    }

    fn width(&self) -> f32 {
        self.game_width
    }

    fn height(&self) -> f32 {
        self.game_height
    }
}

impl Drop for GlowRenderer {
    fn drop(&mut self) {
        unsafe {
            self.gl.delete_program(self.program);
            self.gl.delete_buffer(self.vbo);
            self.gl.delete_vertex_array(self.vao);
            self.gl.delete_program(self.texture_program);
            self.gl.delete_buffer(self.texture_vbo);
            self.gl.delete_vertex_array(self.texture_vao);
        }
    }
}
