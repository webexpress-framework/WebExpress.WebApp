![WebExpress](https://raw.githubusercontent.com/webexpress-framework/.github/main/docs/assets/img/banner.png)

# CollaborativeCtrl

The `CollaborativeCtrl` extends the existing WebExpress infrastructure by using the already available MessageQueue as a communication channel to make collaborative interactions between multiple users visible in real time. The MessageQueue provides a stable WebSocket connection through which status changes, cursor movements, and text input events can be transmitted. The new control acts as a container that can host arbitrary UI elements while simultaneously visualizing the presence of all currently connected users within this area. When the control is initialized, it establishes a connection to the global MessageQueue that is already available in the system. The control registers itself as a listener for incoming messages and sends its own events through the same channel. The MessageQueue ensures reliable transmission of all relevant data, eliminating the need for additional communication logic.

Inside the container, all users reported as active via the MessageQueue are displayed. The control receives presence information sent by other clients and updates the visualization accordingly. In addition, the mouse cursor positions of connected users are displayed in real time. Each client sends its current cursor position through the MessageQueue, while the control receives incoming cursor events from other users and renders them as colored overlays inside the container. The rendering is independent of the underlying UI elements, ensuring that interaction with the interface remains unaffected.

Beyond cursor visualization, the control also supports synchronization of text input. Whenever a user focuses a text field inside the container and begins typing, these input events are transmitted through the MessageQueue to all other clients. The control detects these events, associates them with the corresponding element, and displays the input of other users in real time. This creates a collaborative editing experience that requires no additional backend logic and relies solely on the existing MessageQueue.

The architecture of the control follows the structure of the existing `MessageQueueStatusCtrl`. It uses the same mechanisms for registering and deregistering event handlers and follows the typical WebExpress lifecycle. When the control is removed, all listeners are properly deregistered to avoid memory leaks. The logic is modular, keeping presence tracking, cursor tracking, and input synchronization clearly separated. The MessageQueue serves as the central transport mechanism for all events, enabling consistent, low‑latency, and scalable real‑time communication between all connected clients.

By leveraging the existing MessageQueue, the new control integrates seamlessly into the WebExpress architecture. It requires no additional server components, as the WebSocket infrastructure is already in place. The control extends the existing functionality with collaborative capabilities and provides a foundation for future features such as shared editing, live commenting, or visual annotations within the container. The result is a powerful, extensible, and fully integrated control that enables real‑time collaborative interactions and makes optimal use of the MessageQueue.

```
   ┌───────────────────────────────┐
   │       [User1] [User2] [UserN] │  // user overlay
   │┌─────────────────────────────┐│
   ││                             ││  // content
   ││ Field:                      ││
   ││ ┌─────────────────────────┐ ││
   ││ │ input░                  │ ││  // Mouse & Input User1
   ││ └─────────────────────────┘ ││
   ││      ▒                      ││  // Mouse User1
   │└─────────────────────────────┘│  
   └───────────────────────────────┘
```

## Configuration

Configuration is performed via dataset attributes on the host element:

| Attribute                       | Description
|---------------------------------|----------------------------------------------------
| `data-collaborative-presence`   | Enables the display of connected users
| `data-collaborative-cursor`     | Enables visualization of mouse cursors
| `data-collaborative-input`      | Enables synchronization of text input
| `data-collaborative-color-mode` | Defines how user colors are assigned (auto, fixed)

## Functionality

The CollaborativeCtrl provides three central areas of functionality. The most important behaviors are:

- User presence: The control displays all active users connected through the MessageQueue.  
- Cursor synchronization: Mouse movements are transmitted in real time and displayed as colored cursors.  
- Input synchronization: Text input in contained fields is mirrored live across all clients.  
- Overlay rendering: Cursors and user labels are rendered above the container without blocking the UI.  
- MessageQueue integration: All events are transmitted through the existing WebSocket infrastructure.  

## Programmatic Control

### Accessing an Automatically Created Instance

When the framework instantiates the controller automatically, the instance can be retrieved via the framework registry and read or updated using vanilla JavaScript:

```javascript
var el = document.getElementById('collaborative1');
var ctrl = webexpress.webui.Controller.getInstanceByElement(el);

// Example: retrieve active users
console.log(ctrl.users);
```

### Manual Instantiation

Manual instantiation is supported for direct programmatic use:

```javascript
var el = document.getElementById('collaborative-manual');
var ctrl = new webexpress.webui.CollaborativeCtrl(el);

// Example: disable cursor display
ctrl.enableCursor(false);
```

## Events

The CollaborativeCtrl dispatches its own events that can be consumed by applications:

- `webexpress.webui.Event.COLLABORATIVE_USER_JOIN` – A new user has joined the container  
- `webexpress.webui.Event.COLLABORATIVE_USER_LEAVE` – A user has left the container  
- `webexpress.webui.Event.COLLABORATIVE_CURSOR` – A cursor update has been received  
- `webexpress.webui.Event.COLLABORATIVE_INPUT` – A text input event has been synchronized  

## Use Case Example

Static usage inside HTML:

```html
<div id="collaborative1"
     class="wx-webui-collaborative"
     data-collaborative-presence="true"
     data-collaborative-cursor="true"
     data-collaborative-input="true">
</div>
```