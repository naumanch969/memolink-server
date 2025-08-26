# MemoLink Server

A robust Express.js backend server for the MemoLink application, built with TypeScript, MongoDB, and modern security practices.

## Features

- 🚀 **Express.js** with TypeScript
- 🗄️ **MongoDB** with Mongoose ODM
- 🔐 **JWT Authentication** with bcrypt password hashing
- 🛡️ **Security Middleware** (Helmet, CORS, Rate Limiting)
- 📝 **Input Validation** with express-validator
- 📁 **File Uploads** with Multer and Cloudinary
- 🔍 **Advanced Search** with MongoDB text search
- 📊 **Pagination** and filtering
- 🧪 **Type Safety** with TypeScript interfaces

## Prerequisites

- Node.js (v16 or higher)
- MongoDB (local or cloud instance)
- Cloudinary account (for image uploads)

## Installation

1. **Clone the repository and navigate to the server directory:**
   ```bash
   cd memolink-server
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` with your configuration:
   ```env
   PORT=5000
   NODE_ENV=development
   MONGODB_URI=mongodb://localhost:27017/memolink
   JWT_SECRET=your-super-secret-jwt-key-here
   JWT_EXPIRES_IN=7d
   CLOUDINARY_CLOUD_NAME=your-cloud-name
   CLOUDINARY_API_KEY=your-api-key
   CLOUDINARY_API_SECRET=your-api-secret
   CORS_ORIGIN=http://localhost:3000
   ```

4. **Start MongoDB:**
   ```bash
   # Local MongoDB
   mongod
   
   # Or use MongoDB Atlas (cloud)
   # Update MONGODB_URI in .env
   ```

## Development

**Start development server:**
```bash
npm run dev
```

**Build for production:**
```bash
npm run build
```

**Start production server:**
```bash
npm start
```

## API Endpoints

### Entries
- `GET /api/entries` - Get all entries (with pagination)
- `GET /api/entries/:id` - Get entry by ID
- `POST /api/entries` - Create new entry
- `PUT /api/entries/:id` - Update entry
- `DELETE /api/entries/:id` - Delete entry
- `POST /api/entries/search` - Search entries

### People
- `GET /api/people` - Get all people
- `GET /api/people/:id` - Get person by ID
- `POST /api/people` - Create new person
- `PUT /api/people/:id` - Update person
- `DELETE /api/people/:id` - Delete person

### Categories
- `GET /api/categories` - Get all categories
- `GET /api/categories/:id` - Get category by ID
- `POST /api/categories` - Create new category
- `PUT /api/categories/:id` - Update category
- `DELETE /api/categories/:id` - Delete category

### File Uploads
- `POST /api/upload` - Upload image file

### Health Check
- `GET /health` - Server health status

## Project Structure

```
src/
├── config/          # Configuration files
│   ├── database.ts  # MongoDB connection
│   └── cloudinary.ts # Cloudinary config
├── controllers/     # Route controllers
│   ├── entry.controller.ts
│   ├── person.controller.ts
│   └── category.controller.ts
├── middlewares/     # Custom middleware
│   ├── auth.ts      # Authentication
│   ├── upload.ts    # File uploads
│   └── validation.ts # Input validation
├── models/          # Mongoose models
│   ├── Entry.ts
│   ├── Person.ts
│   ├── Category.ts
│   └── User.ts
├── routes/          # API routes
│   ├── entry.routes.ts
│   ├── person.routes.ts
│   └── category.routes.ts
├── interfaces/      # TypeScript interfaces
├── app.ts          # Express app configuration
└── server.ts       # Server entry point
```

## Security Features

- **Helmet.js** - Security headers
- **CORS** - Cross-origin resource sharing
- **Rate Limiting** - Prevent abuse
- **Input Validation** - Sanitize user input
- **JWT Authentication** - Secure API access
- **Password Hashing** - bcrypt encryption

## Database Models

### Entry
- Content, timestamp, mood
- People references, tags, images
- Created/updated timestamps

### Person
- Name and avatar
- Unique name constraint

### Category
- Name and display name
- Lowercase indexing

### User
- Email and hashed password
- Authentication methods

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 5000 |
| `NODE_ENV` | Environment | development |
| `MONGODB_URI` | MongoDB connection string | localhost:27017/memolink |
| `JWT_SECRET` | JWT signing secret | - |
| `JWT_EXPIRES_IN` | JWT expiration time | 7d |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | - |
| `CLOUDINARY_API_KEY` | Cloudinary API key | - |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | - |
| `CORS_ORIGIN` | Allowed CORS origin | http://localhost:3000 |

## Contributing

1. Follow TypeScript best practices
2. Add proper error handling
3. Include input validation
4. Write meaningful commit messages
5. Test API endpoints

## License

ISC
