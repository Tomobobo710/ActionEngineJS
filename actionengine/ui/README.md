# ActionUI

A canvas-based UI component library for ActionEngine. Renders entirely on a 2D canvas context, requires no DOM, and integrates directly with ActionEngine's input system.

## Quick Start

```html
<!-- Load after ActionEngine modules -->
<script src="game/actionuitheme.js"></script>
<script src="game/actionuicomponent.js"></script>
<script src="game/actionuiiconrenderer.js"></script>
<script src="game/actionuipanel.js"></script>
<!-- ... load remaining components ... -->
<script src="game/actionui.js"></script>
```

```js
// In your Game constructor
this.ui = new ActionUI(canvases, input, theme);

// In action_update()
this.ui.update(dt);

// In action_draw()
this.ui.draw('gui');
```

## Architecture

### ActionUI (Root Manager)

The `ActionUI` class is the entry point. It owns the component tree, wires into ActionEngine's input system, and dispatches update/draw calls.

```js
const ui = new ActionUI(canvases, input, theme);
```

**Methods:**
- `add(...comps)` — Register one or more components. Returns `this` for chaining.
- `remove(id)` — Remove a component by ID.
- `get(id)` — Find a component by ID.
- `update(dt)` — Call every frame from `action_update()`.
- `draw(layer)` — Call from `action_draw()`. Layer: `'gui'`, `'debug'`, `'game'`, or `'all'`.
- `notify(message, type, duration)` — Show a toast notification.
- `openModal(props)` — Open a modal dialog.
- `showContextMenu(menu, x, y)` — Show a context menu at position.
- `sendChar(char)` — Forward character input to the focused text input.

### Factory Methods

ActionUI provides shorthand for creating and registering components in one call:

```js
ui.makeButton({ x: 10, y: 10, width: 120, height: 36, text: 'Click Me', onClick: () => { ... } });
ui.makeLabel({ x: 10, y: 50, text: 'Hello', fontSize: 16 });
ui.makeSlider({ x: 10, y: 90, width: 200, min: 0, max: 100, value: 50 });
// ... etc
```

All factory methods return the created component for further manipulation.

### UITheme

Centralized design tokens. Pass a custom theme to the ActionUI constructor:

```js
const theme = new ActionUITheme({
    colorPrimary: '#7c6aff',
    colorBackground: '#0d0d1a',
    fontSizeMd: 16,
    // ... any token can be overridden
});
const ui = new ActionUI(canvases, input, theme);
```

**Key tokens:**
- Colors: `colorPrimary`, `colorSecondary`, `colorAccent`, `colorSuccess`, `colorWarning`, `colorDanger`, `colorInfo`, `colorBackground`, `colorSurface`, `colorBorder`, `colorText`, `colorTextMuted`
- Typography: `fontFamily`, `fontSizeXs` through `fontSizeDisplay`, `fontWeightNormal/Medium/Bold`
- Spacing: `spacingXs` through `spacingXxl`
- Shape: `radiusSm` through `radiusPill`
- Motion: `animDurationFast`, `animDurationNormal`, `animDurationSlow`

## Components

### ActionUIPanel
Container with optional title bar, shadow, and border. One of three container types that support `addChild()`.

```js
new ActionUIPanel({ x, y, width, height, title: 'My Panel', shadow: true });
```

**Properties:** `title`, `fill`, `border`, `shadow`, `radius`, `padding`

**Methods:**
- `addChild(comp)` — Add a child component. Sets parent relationship for visibility cascading.
- `removeChild(id)` — Remove a child by ID.

### Container Types & Visibility Cascade

Only three components act as containers: **ActionUIPanel**, **ActionUIScrollPanel**, and **ActionUIGrid**. These are the only types with `addChild()`.

When you add a child to a container:
1. The child is automatically registered with ActionUI
2. The child's `_parent` is set to the container
3. If the container's `visible` is set to `false`, the child is also hidden and non-interactive

This means you can build an entire screen inside one panel and toggle it with a single `panel.visible = false`.

### ActionUILabel
Static or wrapped text.

```js
new ActionUILabel({ x, y, width, height, text: 'Hello', fontSize: 14, color: '#fff' });
```

**Properties:** `text`, `fontSize`, `fontWeight`, `color`, `align`, `mono`, `wrap`, `lineHeight`, `ellipsis`, `uppercase`, `shadow`

### ActionUIButton
Interactive button with hover/press animations and ripple effect.

```js
new ActionUIButton({
    x, y, width, height,
    text: 'Click Me',
    variant: 'primary',  // primary|secondary|ghost|danger|success|accent
    icon: 'play',         // optional icon key
    onClick: (btn) => { ... }
});
```

**Properties:** `text`, `variant`, `fontSize`, `radius`, `icon`

### ActionUIIconButton
Square button with icon only.

```js
new ActionUIIconButton({ x, y, width: 36, height: 36, icon: 'settings', onClick: () => { ... } });
```

**Properties:** `icon`, `iconSize`

### ActionUICheckbox
Boolean toggle with optional label.

```js
new ActionUICheckbox({ x, y, width, label: 'Enable feature', checked: true, onChange: (val) => { ... } });
```

**Properties:** `checked`, `label`, `boxSize`

### ActionUIToggleSwitch
iOS-style on/off toggle.

```js
new ActionUIToggleSwitch({ x, y, label: 'Auto-save', checked: true, color: 'primary', onChange: (val) => { ... } });
```

**Properties:** `checked`, `label`, `color`, `clickableLabel`

### ActionUIRadioGroup
Mutually exclusive option set.

```js
new ActionUIRadioGroup({
    x, y, width, height,
    options: [{ label: 'Option A', value: 'a' }, { label: 'Option B', value: 'b' }],
    selected: 0,
    onChange: (value, index) => { ... }
});
```

**Properties:** `options`, `selected`, `direction` (`'vertical'` or `'horizontal'`), `itemHeight`

### ActionUISlider
Continuous value scrubber.

```js
new ActionUISlider({
    x, y, width, height,
    min: 0, max: 100, value: 50, step: 1,
    label: 'Volume',
    color: 'primary',
    onChange: (value) => { ... }
});
```

**Properties:** `min`, `max`, `value`, `step`, `label`, `showValue`, `color`

### ActionUIProgressBar
Read-only value indicator with animation.

```js
new ActionUIProgressBar({
    x, y, width, height,
    value: 0.65,  // 0..1
    color: 'primary',
    label: 'Loading',
    showPct: true,
    striped: true,
    animated: true
});
```

**Properties:** `value`, `color`, `label`, `showPct`, `animated`, `striped`

### ActionUITextInput
Single-line text entry with selection, clipboard, and cursor navigation.

```js
new ActionUITextInput({
    x, y, width, height,
    placeholder: 'Type here…',
    label: 'Name',
    password: false,
    maxLength: 120,
    onChange: (value) => { ... },
    onSubmit: (value) => { ... }
});
```

**Properties:** `value`, `placeholder`, `label`, `maxLength`, `password`

**Keyboard shortcuts:** Ctrl+A (select all), Ctrl+C/X/V (clipboard), Arrow keys (navigation), Home/End, Ctrl+Arrow (word jump), Backspace/Delete, Enter (submit).

### ActionUINumberStepper
Integer value with +/- buttons.

```js
new ActionUINumberStepper({
    x, y, width, height,
    label: 'Players', value: 4, min: 1, max: 8, step: 1,
    onChange: (value) => { ... }
});
```

**Properties:** `value`, `min`, `max`, `step`, `label`

### ActionUIDropdown
Select / combo box with animated dropdown list.

```js
new ActionUIDropdown({
    x, y, width, height,
    label: 'Theme',
    options: [{ label: 'Dark', value: 'dark' }, { label: 'Light', value: 'light' }],
    selected: 0,
    onChange: (value, index) => { ... }
});
```

**Properties:** `options`, `selected`, `label`

### ActionUITabBar
Horizontal tab switcher with animated indicator.

```js
new ActionUITabBar({
    x, y, width, height,
    tabs: [{ label: 'Tab 1', id: 'tab1' }, { label: 'Tab 2', id: 'tab2' }],
    selected: 0,
    onChange: (id, index) => { ... }
});
```

**Properties:** `tabs`, `selected`

### ActionUIScrollPanel
Vertically scrollable container with custom scrollbar.

```js
const panel = new ActionUIScrollPanel({ x, y, width, height, contentHeight: 500 });
panel.addChild(new ActionUIButton({ ... }));
```

**Properties:** `contentHeight`, `radius`, `showBorder`

**Methods:** `addChild(comp)`, `scroll(delta)`

### ActionUIGrid
Auto-layout grid of arbitrary children.

```js
const grid = new ActionUIGrid({ x, y, width, columns: 3, cellHeight: 60, gap: 12 });
grid.addChild(new ActionUIButton({ ... }));
```

**Properties:** `columns`, `gap`, `cellHeight`

### ActionUIModal
Blocking overlay dialog.

```js
ui.openModal({
    title: 'Confirm',
    message: 'Are you sure?',
    buttons: [
        { label: 'Cancel', value: 'cancel', variant: 'ghost' },
        { label: 'OK', value: 'ok', variant: 'primary' }
    ],
    onClose: (value) => { ... }
});
```

### ActionUINotification
Transient toast message.

```js
ui.notify('Saved!', 'success');
ui.notify('Error occurred', 'danger');
```

**Types:** `info`, `success`, `warning`, `danger`

### ActionUITooltip
Hover-triggered floating hint. Managed automatically by ActionUI — set `tooltip` on any component.

### ActionUIContextMenu
Right-click popup menu.

```js
const menu = ui.makeContextMenu({
    items: [
        { label: 'New', icon: 'plus', value: 'new' },
        { separator: true },
        { label: 'Delete', icon: 'trash', value: 'delete' }
    ],
    onChange: (value, index) => { ... }
});
ui.showContextMenu(menu, x, y);
```

### ActionUISeparator
Horizontal or vertical rule with optional label.

```js
new ActionUISeparator({ x, y, width, height: 1, label: 'Section' });
```

**Properties:** `direction` (`'horizontal'` or `'vertical'`), `label`, `color`

### ActionUIBadge
Numeric indicator dot.

```js
new ActionUIBadge({ x, y, count: 5, color: 'danger', size: 20 });
```

**Properties:** `count`, `color`, `maxCount`, `size`

### ActionUIColorSwatch
Static color display tile.

```js
new ActionUIColorSwatch({ x, y, size: 36, color: '#e94560', label: 'Red', onClick: (color) => { ... } });
```

**Properties:** `color`, `label`, `size`

### ActionUISpinner
Animated loading indicator.

```js
new ActionUISpinner({ x, y, size: 32, color: 'primary', label: 'Loading', speed: 2.0 });
```

**Properties:** `color`, `size`, `speed`, `label`

### ActionUIAvatarDisplay
Circular icon with initials fallback.

```js
new ActionUIAvatarDisplay({ x, y, size: 40, name: 'John Doe', status: 'online', onClick: () => { ... } });
```

**Properties:** `name`, `color`, `size`, `status` (`'online'`, `'offline'`, `'away'`)

## Parent-Child Visibility

Components added via `panel.addChild()` inherit their parent's visibility. When a panel is hidden, all its children are automatically hidden and non-interactive.

```js
const panel = new ActionUIPanel({ x, y, width, height });
ui.add(panel);

panel.addChild(new ActionUIButton({ ... }));  // auto-registered with ActionUI
panel.addChild(new ActionUILabel({ ... }));

panel.visible = false;  // hides panel AND all children
```

## Keyboard / Gamepad Navigation

ActionUI supports full keyboard navigation with no extra configuration:

- **DirUp/Down/Left/Right** — Move focus between interactive components
- **Action1** — Activate focused component (click button, toggle checkbox, open dropdown, etc.)
- **Action2** — Cancel / close / deselect

**Focus ring colors:**
- **Cyan** — Component is focused but not active
- **Yellow** — Component is focused AND active (controllable with directional keys)

**Component-specific behavior:**
- **TabBar:** Action1 activates → DirLeft/Right changes tab → Action2 deactivates
- **Slider:** Action1 activates → DirLeft/Right/Up/Down adjusts value → Action2 deactivates
- **Dropdown:** Action1 opens → DirUp/Down scrolls → Action1 selects and closes → Action2 cancels
- **RadioGroup:** Action1 activates → DirUp/Down changes option → Action2 deactivates
- **NumberStepper:** Action1 activates → DirLeft/Right changes value → Action2 deactivates
- **Checkbox/Toggle:** Action1 toggles directly (no active mode)
- **TextInput:** Captures all keyboard input when focused

Mouse hovering over any interactive component clears the keyboard focus ring.

## Icon System

Built-in vector icons drawn on canvas. Register custom icons at runtime:

```js
ActionUIIconRenderer.register('myIcon', (ctx, size) => {
    // Draw into [0, 0, size, size] bounding box
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(size, size);
    ctx.stroke();
});
```

**Built-in icons:** `close`, `check`, `plus`, `minus`, `arrow_right`, `arrow_left`, `arrow_up`, `arrow_down`, `settings`, `info`, `warning`, `star`, `heart`, `search`, `menu`, `volume`, `play`, `pause`, `refresh`, `trash`, `lock`

## Component Properties (Base)

All components inherit from `ActionUIComponent` and share these properties:

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `id` | string | auto-generated | Unique identifier |
| `x`, `y` | number | 0 | Position |
| `width`, `height` | number | 100/32 | Size |
| `visible` | bool | true | Visibility |
| `enabled` | bool | true | Interactivity |
| `tooltip` | string | null | Hover tooltip text |
| `zIndex` | number | 0 | Draw order (higher = on top) |
| `layer` | string | `'gui'` | Canvas layer: `'gui'`, `'debug'`, `'game'` |
| `opacity` | number | 1 | Transparency |
| `tag` | any | null | Arbitrary user data |
| `isInteractive` | bool | false | Can receive keyboard focus |

**Callbacks:** `onClick`, `onHoverEnter`, `onHoverLeave`, `onChange`

## Canvas Coordinate System

ActionUI uses ActionEngine's fixed 800×600 coordinate system. All positions are in this space regardless of actual canvas resolution.
