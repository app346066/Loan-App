# Loan Management App

A comprehensive loan tracking application built with Node.js, Express, and MongoDB.

## Features

- ✅ **Loan Management** - Add, view, update, delete loans
- ✅ **Payment Tracking** - Record payments and update balances  
- ✅ **Interest Calculations** - Supports monthly/annual interest rates
- ✅ **Penalty Management** - Add penalties for late payments
- ✅ **Dashboard Analytics** - Visual charts and statistics
- ✅ **Responsive Design** - Works on mobile and desktop
- ✅ **Hybrid Storage** - MongoDB with file-based fallback

## Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env.local
   ```
   
   Update `.env.local` with your MongoDB connection string.

3. **Start the application:**
   ```bash
   npm start
   ```

4. **Access the app:**
   Open `http://localhost:3000` in your browser.

## Vercel Deployment

### Prerequisites
- Vercel account
- MongoDB Atlas database
- Git repository

### Deployment Steps

1. **Push your code to GitHub/GitLab/Bitbucket**

2. **Connect to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Import your repository
   - Select your project

3. **Configure Environment Variables in Vercel:**
   Go to Project Settings → Environment Variables and add:
   ```
   MONGODB_URI = your_mongodb_atlas_connection_string
   MONGODB_DB = loanapp
   ```

4. **Deploy:**
   Vercel will automatically deploy your app.

### MongoDB Atlas Setup

1. **Create a MongoDB Atlas Account:**
   - Go to [mongodb.com/atlas](https://mongodb.com/atlas)
   - Create a free cluster

2. **Create Database User:**
   - Go to Database Access
   - Add a new database user
   - Save the username and password

3. **Whitelist IP Addresses:**
   - Go to Network Access
   - Add IP address `0.0.0.0/0` (for Vercel deployment)

4. **Get Connection String:**
   - Go to Clusters → Connect
   - Choose "Connect your application"
   - Copy the connection string
   - Replace `<password>` with your database user password

### Troubleshooting

**MongoDB Connection Issues:**
- Verify username/password in connection string
- Check if IP address is whitelisted
- Ensure database user has read/write permissions
- The app has automatic fallback to file storage if MongoDB fails

**Vercel Deployment Issues:**
- Check build logs in Vercel dashboard
- Verify environment variables are set correctly
- Ensure all dependencies are in package.json

## File Structure

```
loan-app/
├── server.js          # Main server file
├── index.html         # Frontend application
├── package.json       # Dependencies and scripts
├── vercel.json        # Vercel configuration
├── .env.local         # Environment variables (local)
├── .env.example       # Environment variables template
├── data.json          # File-based storage fallback
└── README.md          # This file
```

## API Endpoints

- `GET /api/loans` - Get all loans
- `POST /api/loans` - Create new loan
- `PUT /api/loans?id=<loan_id>` - Update loan (payments/penalties)
- `DELETE /api/loans?id=<loan_id>` - Delete loan

## Technologies Used

- **Backend:** Node.js, Express.js
- **Database:** MongoDB Atlas (with file fallback)
- **Frontend:** Vanilla HTML/CSS/JavaScript
- **Deployment:** Vercel
- **Charts:** Chart.js

## License

MIT License