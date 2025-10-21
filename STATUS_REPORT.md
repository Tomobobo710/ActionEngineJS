# Memory Palace 3D - Status Report

## 1. Missing Features (from TODO list)

### Phase 1: Quick Wins
*   [ ] Implement color-coded categories for notes
*   [ ] Implement basic particle effects for important notes

### Phase 2: Medium Impact
*   [ ] Implement simple 3D model import as note containers
*   [ ] Implement water shader for atmospheric backgrounds
*   [ ] Implement basic animations for note states

### Phase 3: Advanced Features
*   [ ] Implement full GLB model support for custom note objects
*   [ ] Implement complex physics interactions between notes
*   [ ] Implement advanced particle systems for note relationships
*   [ ] Implement procedural note generation based on content

## 2. Current Problems

### 2.1. Database Schema Mismatch
**Problem:** The server output indicates `⚠️ Dropping and recreating blocks table. ALL EXISTING BLOCKS WILL BE DELETED.` and `✅ Blocks table dropped (if existed)`. However, the previous error `SQLITE_ERROR: table blocks has no column named title` suggests that the database schema changes (adding the `title` column) were not correctly applied or persisted. This is likely due to the user denying the deletion of `database/memorypalace.db` in a previous step, which is necessary for the `ALTER TABLE` statement to take effect on a fresh table creation.

**Resolution Needed:** The `database/memorypalace.db` file needs to be deleted to allow the server to recreate the `blocks` table with the updated schema, including the `title` column.

### 2.2. `TextEditor.open` Error
**Problem:** `TypeError: Cannot read properties of undefined (reading 'length') at TextEditor.open (game.js:630:54)`. This error occurs when `block.getText()` or `block.getTitle()` returns `undefined` within the `TextEditor.open` method. While checks were added, the error persists, indicating the client-side `game.js` file might not have the latest changes or there's an edge case where `block` itself is `undefined`.

**Resolution Needed:** The `game.js` file needs to be fully updated with the provided code to ensure all necessary null/undefined checks and logic are in place.

### 2.3. Block Persistence
**Problem:** The initial question "when I kill the server do the "boxes" disappear when I restart the server?" directly addresses block persistence. The server output `⚠️ Dropping and recreating blocks table. ALL EXISTING BLOCKS WILL BE DELETED.` confirms that blocks are indeed deleted on server restart.

**Resolution Needed:** To achieve block persistence, the `database.js` file needs to be modified to *not* drop and recreate the `blocks` table on every server start. Instead, it should only create the table *if it doesn't already exist* and then apply any necessary schema migrations (like adding new columns) without deleting existing data. This will be a critical next step after resolving the current schema mismatch.

## 3. Remaining Tasks (from TODO list)

### Phase 1: Quick Wins
*   [ ] Implement color-coded categories for notes
*   [ ] Implement basic particle effects for important notes

### Phase 2: Medium Impact
*   [ ] Implement simple 3D model import as note containers
*   [ ] Implement water shader for atmospheric backgrounds
*   [ ] Implement basic animations for note states

### Phase 3: Advanced Features
*   [ ] Implement full GLB model support for custom note objects
*   [ ] Implement complex physics interactions between notes
*   [ ] Implement advanced particle systems for note relationships
*   [ ] Implement procedural note generation based on content

## 4. OOP Refactoring Plan for `game.js`

### Why OOP Refactoring is Beneficial for `game.js`:

1.  **Improved Readability and Maintainability**:
    *   **Encapsulation**: Group related data and functions into classes (e.g., `Player`, `MemoryBlock`, `TextEditor`, `Renderer`). This makes it easier to understand what each part of the code does without needing to know all its internal workings.
    *   **Abstraction**: Hide complex implementation details. For instance, the `Renderer` class abstracts away the raw WebGL calls, providing a simpler `drawMesh` interface.
    *   **Modularity**: Breaking the large `Game` class into smaller, focused classes makes the codebase easier to navigate, debug, and update.

2.  **Enhanced Scalability and Extensibility**:
    *   **Inheritance**: Easily create new types of `MemoryBlock` (e.g., `ConeBlock`, `SphereBlock`, `ModelBlock`) that inherit common properties and methods from a base `MemoryBlock` class, but have their own unique `createVisual` or `draw` implementations. This directly supports your "Advanced Physics Shapes" and "3D Model Integration" ideas.
    *   **Polymorphism**: Treat different types of blocks (cubes, cones, spheres) uniformly through a common interface (e.g., `block.draw()`). This simplifies the game loop and rendering logic.
    *   **Loose Coupling**: Components become less dependent on each other's internal details, reducing the risk of introducing bugs when one part of the system changes.

3.  **Better Collaboration and Feature Development**:
    *   With a clear class structure, different features can be developed and integrated more independently. For example, one developer could work on particle effects while another refines input handling, without constantly stepping on each other's toes in a monolithic `game.js` file.

### Potential Dangers (and how to mitigate them):

The main danger is **over-engineering** or introducing unnecessary complexity if not done thoughtfully.

*   **Mitigation**: We'll focus on identifying clear, distinct responsibilities and creating classes only where they genuinely improve organization and extensibility. We'll start with the most obvious candidates and iterate.

### Proposed Refactoring Strategy:

We'll aim to extract distinct functionalities into their own classes and potentially their own files, making `game.js` primarily an orchestrator.

Here's a high-level plan:

1.  **Identify Core Classes**:
    *   `Game` (Orchestrator)
    *   `Player` (Already exists, but can be further refined)
    *   `Level` (Already exists, but can be further refined)
    *   `MemoryBlock` (Already exists, will be base for new shapes)
    *   `TextEditor` (Already exists, can be made more independent)
    *   `Renderer` (Already exists, can be made more independent)
    *   `InputHandler` (Already exists, can be made more independent)
    *   `AudioManager` (Already exists, can be made more independent)
    *   `SceneManager` (New: to manage all 3D objects, including blocks, player, level)
    *   `PhysicsEngine` (New: to centralize physics calculations)
    *   `UIManager` (New: to manage all 2D UI elements like HUD, messages, editor)

2.  **Modularize into Separate Files**: Each major class will get its own `.js` file (e.g., `player.js`, `sceneManager.js`, `uiManager.js`). This improves organization and allows for better code splitting if needed.

3.  **Define Clear Interfaces**: Ensure classes interact through well-defined public methods, minimizing direct access to internal properties.

4.  **Iterative Refactoring**: We won't do it all at once. We'll tackle one logical chunk at a time, ensuring the application remains functional after each step.

### Visualizing the New Structure (Mermaid Diagram):

```mermaid
classDiagram
    direction LR
    class Game {
        +InputHandler input
        +AudioManager audio
        +SceneManager scene
        +UIManager ui
        +Player player
        +Renderer renderer
        +Level level
        +init()
        +update()
        +draw()
        +addMessage()
        +saveToStorage()
        +loadFromStorage()
        +deleteBlock()
        +placeBlock()
        +openBlockEditor()
    }

    class Player {
        +Vector3 position
        +Vector3 rotation
        +update(deltaTime)
        +getViewMatrix()
    }

    class Level {
        +Mesh mesh
        +collisionBoxes[]
        +createGeometry()
        +draw(renderer, viewMatrix, projectionMatrix)
    }

    class MemoryBlock {
        +string id
        +Vector3 position
        +string type
        +string text
        +string title
        +number blockSize
        +ActionModel3D model
        +createVisual()
        +setText(text)
        +setTitle(title)
        +toJSON()
        +static fromJSON()
        +draw(renderer, viewMatrix, projectionMatrix)
    }

    class TextEditor {
        +MemoryBlock currentBlock
        +string textContent
        +string titleContent
        +open(block)
        +close()
        +save()
        +deleteNote()
        +deleteBlock()
        +handleInput()
        +update(deltaTime)
        +draw(ctx)
    }

    class Renderer {
        +initGL()
        +addShaderProgram()
        +setupShader()
        +drawMesh()
        +clear()
    }

    class SceneManager {
        +Set<ActionModel3D> sceneObjects
        +add(model)
        +remove(model)
        +draw(renderer, viewMatrix, projectionMatrix)
    }

    class UIManager {
        +drawHUD()
        +drawMessages()
        +drawClickToStart()
        +drawDebugInfo()
    }

    Game "1" *-- "1" Player : manages
    Game "1" *-- "1" Level : manages
    Game "1" *-- "1" TextEditor : manages
    Game "1" *-- "1" Renderer : uses
    Game "1" *-- "1" InputHandler : uses
    Game "1" *-- "1" AudioManager : uses
    Game "1" *-- "1" SceneManager : orchestrates
    Game "1" *-- "1" UIManager : orchestrates

    SceneManager "1" *-- "*" MemoryBlock : contains
    MemoryBlock "1" *-- "1" ActionModel3D : has

    TextEditor "1" *-- "1" MemoryBlock : edits