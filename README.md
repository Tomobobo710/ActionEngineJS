# 🏛️ Memory Palace 3D

A 3D spatial memory system based on the ancient **Method of Loci** technique, built with ActionEngine and WebGL.

## ✨ Features

- **3D Environment**: Navigate a fully 3D space to place and organize memory blocks
- **Text Storage**: Each block can store unlimited text content
- **Spatial Memory**: Leverage spatial memory for better retention
- **Persistent Storage**: Automatic saving to both localStorage and backend server
- **Flying Mode**: Toggle between walking and flying for easy navigation
- **Export/Import**: Save and share your memory palaces as JSON files
- **Offline Support**: Works without internet connection using localStorage

## 🚀 Quick Start

### Prerequisites

- Node.js 14+ and npm
- Modern web browser with WebGL support

### Installation

```bash
# Install dependencies
npm install

# Initialize database
npm run init-db

# Start the server
npm start
```

The application will be available at `http://localhost:3000`

## 🎮 Controls

### Movement
- **WASD** - Move around
- **Mouse** - Look around
- **Space** - Jump / Fly up (in flying mode)
- **Shift** - Sprint / Fly down (in flying mode)
- **F** - Toggle flying mode

### Actions
- **Left Click** - Place a new memory block
- **Right Click** - Edit the selected block's text
- **Middle Click** - Delete the selected block
- **E** - Edit selected block
- **Delete** - Remove selected block

### System
- **Ctrl+S** - Manual save
- **Ctrl+L** - Reload from storage
- **Ctrl+E** - Export to JSON file
- **Ctrl+I** - Import from JSON file
- **Escape** - Release mouse / Close editor

## 📁 Project Structure

```
memory-palace-3d/
├── server/                 # Backend server
│   ├── server.js          # Express server
│   ├── routes/            # API routes
│   ├── controllers/       # Business logic
│   └── config/            # Database configuration
├── ActionEngineJS/         # Frontend application
│   ├── index.html         # Main HTML file
│   ├── game.js            # Game logic
│   ├── api.js             # API client
│   ├── css/               # Stylesheets
│   ├── actionengine/      # ActionEngine framework
│   └── lib/               # Third-party libraries
├── database/              # SQLite database storage
├── package.json           # Node.js dependencies
└── README.md             # This file
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
PORT=3000
NODE_ENV=development
DATABASE_PATH=./database/memorypalace.db
CORS_ORIGIN=http://localhost:3000
```

### Database

The application uses SQLite for data persistence. The database is automatically created on first run.

## 📡 API Endpoints

### Blocks
- `GET /api/blocks` - Get all blocks
- `GET /api/blocks/:id` - Get single block
- `POST /api/blocks` - Create new block
- `PUT /api/blocks/:id` - Update block
- `DELETE /api/blocks/:id` - Delete block
- `POST /api/blocks/bulk` - Bulk save blocks

### Camera
- `GET /api/blocks/camera/state` - Get camera state
- `PUT /api/blocks/camera/state` - Save camera state

### System
- `GET /api/health` - Health check
- `GET /api/blocks/stats` - Get statistics

## 🎨 Customization

### Block Colors

Edit `game.js` to customize block colors:

```javascript
model.setColor(0.3, 0.5, 0.9); // RGB values (0-1)
```

### Ground Appearance

Modify the ground plane in `createGround()`:

```javascript
groundModel.setColor(0.2, 0.6, 0.2); // Green grass
```

## 🐛 Troubleshooting

### Backend Connection Issues

If the backend is not connecting:
1. Ensure the server is running (`npm start`)
2. Check the console for error messages
3. Verify the PORT in `.env` matches your setup
4. The app will fall back to localStorage if backend is unavailable

### WebGL Issues

If the 3D view is not rendering:
1. Check browser WebGL support at https://get.webgl.org/
2. Update your graphics drivers
3. Try a different browser (Chrome, Firefox, Edge recommended)

### Performance Issues

For better performance:
1. Reduce the number of blocks
2. Close other browser tabs
3. Lower your screen resolution
4. Disable browser extensions

## 📚 Method of Loci

The **Method of Loci** (memory palace technique) is an ancient mnemonic device:

1. **Create a familiar space** - Your 3D environment
2. **Place memory items** - Add blocks with information
3. **Navigate the space** - Walk through to recall information
4. **Use spatial relationships** - Position matters for memory

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## 📄 License

MIT License - See LICENSE file for details

## 🙏 Acknowledgments

- **ActionEngine** - 3D game engine framework
- **Goblin Physics** - Physics engine
- **sf2-player** - Audio synthesis
- Method of Loci technique - Ancient Greek memory masters

## 📞 Support

For issues and questions:
- Open an issue on GitHub
- Check the troubleshooting section
- Review the console for error messages

---

**Built with ❤️ using ActionEngine**