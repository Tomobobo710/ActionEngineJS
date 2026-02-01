//! Game runner for WebAssembly using winit + glow (WebGL)

use crate::{Game, GameLoop};
use super::input::WinitInput;
use super::renderer::GlowRenderer;

use wasm_bindgen::JsCast;
use winit::application::ApplicationHandler;
use winit::event::{MouseScrollDelta, WindowEvent};
use winit::event_loop::{ActiveEventLoop, ControlFlow, EventLoop};
use winit::platform::web::WindowAttributesExtWebSys;
use winit::window::{Window, WindowAttributes, WindowId};

/// Run a game with the glow backend (WebGL)
pub fn run<G: Game + 'static>(title: &str) {
    // Set up better panic messages
    console_error_panic_hook::set_once();

    let event_loop = EventLoop::new().expect("Failed to create event loop");
    // Use Wait on web - works better with requestAnimationFrame
    event_loop.set_control_flow(ControlFlow::Wait);

    let mut app = WebApp::<G>::new(title);
    event_loop.run_app(&mut app).expect("Event loop failed");
}

struct WebApp<G: Game> {
    title: String,
    state: Option<AppState<G>>,
}

struct AppState<G: Game> {
    window: Window,
    game_loop: GameLoop<G>,
    renderer: GlowRenderer,
    input: WinitInput,
    last_frame: f64,
}

impl<G: Game> WebApp<G> {
    fn new(title: &str) -> Self {
        Self {
            title: title.to_string(),
            state: None,
        }
    }
}

impl<G: Game> ApplicationHandler for WebApp<G> {
    fn resumed(&mut self, event_loop: &ActiveEventLoop) {
        if self.state.is_some() {
            return;
        }

        let game_width = G::WIDTH;
        let game_height = G::HEIGHT;

        // Get or create canvas
        let window = web_sys::window().expect("No window");
        let document = window.document().expect("No document");

        let canvas = document
            .get_element_by_id("canvas")
            .and_then(|e| e.dyn_into::<web_sys::HtmlCanvasElement>().ok())
            .unwrap_or_else(|| {
                let canvas = document
                    .create_element("canvas")
                    .unwrap()
                    .dyn_into::<web_sys::HtmlCanvasElement>()
                    .unwrap();
                canvas.set_id("canvas");
                document.body().unwrap().append_child(&canvas).unwrap();
                canvas
            });

        canvas.set_width(game_width);
        canvas.set_height(game_height);

        // Create winit window from canvas
        let window_attrs = WindowAttributes::default()
            .with_title(&self.title)
            .with_canvas(Some(canvas.clone()));

        let winit_window = event_loop
            .create_window(window_attrs)
            .expect("Failed to create window");

        // Create WebGL2 context
        let webgl2_context = canvas
            .get_context("webgl2")
            .unwrap()
            .unwrap()
            .dyn_into::<web_sys::WebGl2RenderingContext>()
            .unwrap();

        let gl = glow::Context::from_webgl2_context(webgl2_context);

        let renderer = GlowRenderer::new(gl, game_width, game_height);
        let input = WinitInput::new(game_width, game_height);
        let game_loop = GameLoop::new(1.0 / 60.0);

        // Get current time
        let performance = window.performance().expect("No performance");
        let last_frame = performance.now() / 1000.0;

        self.state = Some(AppState {
            window: winit_window,
            game_loop,
            renderer,
            input,
            last_frame,
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
                let window = web_sys::window().expect("No window");
                let performance = window.performance().expect("No performance");
                let now = performance.now() / 1000.0;
                let dt = (now - state.last_frame) as f32;
                state.last_frame = now;

                // Update game
                state.game_loop.update(dt, &state.input);

                // Render
                state.renderer.begin_frame();
                state.game_loop.draw(&mut state.renderer);
                state.renderer.end_frame();

                // Clear "just pressed" states for next frame
                state.input.begin_frame();

                // Request next frame (uses requestAnimationFrame on web)
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
