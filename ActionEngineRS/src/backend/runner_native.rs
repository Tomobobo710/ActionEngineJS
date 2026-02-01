//! Game runner using winit + glutin + glow

use crate::{Game, GameLoop};
use super::input::WinitInput;
use super::renderer::GlowRenderer;

use std::ffi::CString;
use std::num::NonZeroU32;

use glutin::config::ConfigTemplateBuilder;
use glutin::context::{ContextApi, ContextAttributesBuilder, Version};
use glutin::display::GetGlDisplay;
use glutin::prelude::*;
use glutin::surface::{SurfaceAttributesBuilder, WindowSurface};
use glutin_winit::DisplayBuilder;
use raw_window_handle::HasWindowHandle;
use winit::application::ApplicationHandler;
use winit::event::{MouseScrollDelta, WindowEvent};
use winit::event_loop::{ActiveEventLoop, ControlFlow, EventLoop};
use winit::window::{Window, WindowAttributes, WindowId};

/// Run a game with the glow backend
pub fn run<G: Game + 'static>(title: &str) {
    let event_loop = EventLoop::new().expect("Failed to create event loop");
    event_loop.set_control_flow(ControlFlow::Poll);

    let mut app = GlowApp::<G>::new(title);
    event_loop.run_app(&mut app).expect("Event loop failed");
}

struct GlowApp<G: Game> {
    title: String,
    state: Option<AppState<G>>,
}

struct AppState<G: Game> {
    window: Window,
    gl_surface: glutin::surface::Surface<WindowSurface>,
    gl_context: glutin::context::PossiblyCurrentContext,
    game_loop: GameLoop<G>,
    renderer: GlowRenderer,
    input: WinitInput,
    last_frame: std::time::Instant,
}

impl<G: Game> GlowApp<G> {
    fn new(title: &str) -> Self {
        Self {
            title: title.to_string(),
            state: None,
        }
    }
}

impl<G: Game> ApplicationHandler for GlowApp<G> {
    fn resumed(&mut self, event_loop: &ActiveEventLoop) {
        if self.state.is_some() {
            return;
        }

        let game_width = G::WIDTH;
        let game_height = G::HEIGHT;

        // Create window
        let window_attrs = WindowAttributes::default()
            .with_title(&self.title)
            .with_inner_size(winit::dpi::LogicalSize::new(game_width, game_height));

        let template = ConfigTemplateBuilder::new().with_alpha_size(8);

        let display_builder = DisplayBuilder::new().with_window_attributes(Some(window_attrs));

        let (window, gl_config) = display_builder
            .build(event_loop, template, |configs| {
                configs
                    .reduce(|accum, config| {
                        if config.num_samples() > accum.num_samples() {
                            config
                        } else {
                            accum
                        }
                    })
                    .expect("No suitable GL config found")
            })
            .expect("Failed to create window");

        let window = window.expect("No window created");
        let gl_display = gl_config.display();

        // Create GL context
        let context_attrs = ContextAttributesBuilder::new()
            .with_context_api(ContextApi::OpenGl(Some(Version::new(2, 1))))
            .build(window.window_handle().ok().map(|h| h.as_raw()));

        let not_current_context = unsafe {
            gl_display
                .create_context(&gl_config, &context_attrs)
                .expect("Failed to create GL context")
        };

        // Create surface
        let size = window.inner_size();
        let surface_attrs = SurfaceAttributesBuilder::<WindowSurface>::new().build(
            window.window_handle().unwrap().as_raw(),
            NonZeroU32::new(size.width.max(1)).unwrap(),
            NonZeroU32::new(size.height.max(1)).unwrap(),
        );

        let gl_surface = unsafe {
            gl_display
                .create_window_surface(&gl_config, &surface_attrs)
                .expect("Failed to create surface")
        };

        // Make context current
        let gl_context = not_current_context
            .make_current(&gl_surface)
            .expect("Failed to make context current");

        // Load GL functions
        let gl = unsafe {
            glow::Context::from_loader_function_cstr(|name| {
                gl_display.get_proc_address(&CString::new(name.to_bytes()).unwrap())
            })
        };

        let mut renderer = GlowRenderer::new(gl, game_width, game_height);
        renderer.update_viewport(size.width, size.height);

        let input = WinitInput::new(game_width, game_height);
        let game_loop = GameLoop::new(1.0 / 60.0);

        self.state = Some(AppState {
            window,
            gl_surface,
            gl_context,
            game_loop,
            renderer,
            input,
            last_frame: std::time::Instant::now(),
        });
    }

    fn window_event(&mut self, event_loop: &ActiveEventLoop, _id: WindowId, event: WindowEvent) {
        let state = match &mut self.state {
            Some(s) => s,
            None => return,
        };

        match event {
            WindowEvent::CloseRequested => {
                event_loop.exit();
            }

            WindowEvent::Resized(size) => {
                if size.width > 0 && size.height > 0 {
                    state.gl_surface.resize(
                        &state.gl_context,
                        NonZeroU32::new(size.width).unwrap(),
                        NonZeroU32::new(size.height).unwrap(),
                    );
                    state.renderer.update_viewport(size.width, size.height);
                    state.input.set_window_size(size.width, size.height);
                }
            }

            WindowEvent::KeyboardInput { event, .. } => {
                state.input.handle_keyboard(event.physical_key, event.state);
            }

            WindowEvent::CursorMoved { position, .. } => {
                state.input.handle_mouse_move(position.x, position.y);
            }

            WindowEvent::MouseInput { button, state: btn_state, .. } => {
                state.input.handle_mouse_button(button, btn_state);
            }

            WindowEvent::MouseWheel { delta, .. } => {
                let (dx, dy) = match delta {
                    MouseScrollDelta::LineDelta(x, y) => (x * 20.0, y * 20.0),
                    MouseScrollDelta::PixelDelta(pos) => (pos.x as f32, pos.y as f32),
                };
                state.input.handle_scroll(dx, dy);
            }

            WindowEvent::RedrawRequested => {
                let now = std::time::Instant::now();
                let dt = now.duration_since(state.last_frame).as_secs_f32();
                state.last_frame = now;

                // Update game
                state.game_loop.update(dt, &state.input);

                // Render
                state.renderer.begin_frame();
                state.game_loop.draw(&mut state.renderer);
                state.renderer.end_frame();

                // Swap buffers
                state.gl_surface.swap_buffers(&state.gl_context).ok();

                // Clear "just pressed" states for next frame
                state.input.begin_frame();

                // Request another frame
                state.window.request_redraw();
            }

            _ => {}
        }
    }

    fn about_to_wait(&mut self, _event_loop: &ActiveEventLoop) {
        if let Some(state) = &self.state {
            state.window.request_redraw();
        }
    }
}
