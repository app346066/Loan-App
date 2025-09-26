// api/index.js - Vercel Serverless Function for Loan Management
const fs = require("fs");
const path = require("path");

// Only import MongoDB when needed to avoid startup crashes
let MongoClient, ObjectId;
try {
  const mongodb = require("mongodb");
  MongoClient = mongodb.MongoClient;
  ObjectId = mongodb.ObjectId;
  console.log('✅ MongoDB imported successfully');
} catch (err) {
  console.error('❌ MongoDB import failed:', err.message);
  console.log('📁 Will use file storage only');
}

// Environment setup
const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "loanapp";

// Global state
let db;
let useFileStorage = !MongoClient; // Use file storage if MongoDB not available

// File storage setup - using /tmp for serverless (Vercel provides this)
const dataFile = path.join('/tmp', 'data.json');

// Log startup info
console.log('🚀 Serverless function starting...');
console.log('📍 Data file path:', dataFile);
console.log('🔗 MongoDB URI provided:', !!uri);
console.log('🗃️ Database name:', dbName);
console.log('📦 MongoDB available:', !!MongoClient);

// Helper functions for file operations
function readData() {
  try {
    if (fs.existsSync(dataFile)) {
      const data = fs.readFileSync(dataFile, 'utf8');
      return JSON.parse(data);
    }
    return { borrowers: [] };
  } catch (error) {
    console.error('Error reading data:', error);
    return { borrowers: [] };
  }
}

function writeData(data) {
  try {
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing data:', error);
    return false;
  }
}

function generateId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

// Calculate initial remaining balance including interest
function calculateInitialBalance(loanAmount, interestRate, term, interestType) {
  if (loanAmount <= 0 || term <= 0) return loanAmount;
  
  // Convert annual rate to monthly if needed
  let monthlyInterestRate;
  if (interestType === 'annually') {
    monthlyInterestRate = interestRate / 12;
  } else {
    monthlyInterestRate = interestRate;
  }
  
  // Calculate total interest: loan amount × interest rate (%) × term
  const monthlyInterest = loanAmount * (monthlyInterestRate / 100);
  const totalInterest = monthlyInterest * term;
  
  // Initial remaining balance = loan amount + total interest + penalties (0 for new loans)
  return loanAmount + totalInterest;
}

// Connect to MongoDB with fallback
async function connectToDatabase() {
  if (db) return db;
  if (useFileStorage) return null;

  // Check if MongoDB modules are available
  if (!MongoClient || !ObjectId) {
    console.log("ℹ️ MongoDB modules not available, using file storage");
    useFileStorage = true;
    return null;
  }

  // Check if MongoDB URI is available
  if (!uri) {
    console.log("ℹ️ No MongoDB URI provided, using file storage");
    useFileStorage = true;
    return null;
  }

  try {
    const client = new MongoClient(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
    });

    await client.connect();
    db = client.db(dbName);
    console.log("✅ Connected to MongoDB Atlas");
    return db;
  } catch (error) {
    console.error("❌ MongoDB connection failed, using file storage:", error.message);
    useFileStorage = true;
    console.log("ℹ️ Using file-based storage as fallback");
    return null;
  }
}

// Main handler
module.exports = async function handler(req, res) {
  try {
    console.log(`📨 ${req.method} ${req.url}`);

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // Handle different HTTP methods
    if (req.method === 'GET') {
      return await handleGetLoans(req, res);
    } else if (req.method === 'POST') {
      return await handleCreateLoan(req, res);
    } else if (req.method === 'PUT') {
      return await handleUpdateLoan(req, res);
    } else if (req.method === 'DELETE') {
      return await handleDeleteLoan(req, res);
    } else {
      res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']);
      return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
    }
  } catch (error) {
    console.error('Critical error in handler:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({ 
      message: "Internal Server Error",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
};

// GET loans handler
async function handleGetLoans(req, res) {
  try {
    const database = await connectToDatabase();
    
    if (database && !useFileStorage) {
      // Use MongoDB
      const collection = database.collection("borrowers");
      const borrowers = await collection.find({}).sort({ createdAt: -1 }).toArray();
      console.log(`📊 Retrieved ${borrowers.length} borrowers from MongoDB`);
      return res.json(borrowers);
    } else {
      // Use file storage
      const data = readData();
      const borrowers = data.borrowers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      console.log(`📊 Retrieved ${borrowers.length} borrowers from file storage`);
      return res.json(borrowers);
    }
  } catch (err) {
    console.error('Error fetching loans:', err);
    // Fallback to file storage on any error
    try {
      const data = readData();
      const borrowers = data.borrowers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      console.log(`📊 Fallback: Retrieved ${borrowers.length} borrowers from file storage`);
      return res.json(borrowers);
    } catch (fileErr) {
      console.error('File storage also failed:', fileErr);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  }
}

// POST loans handler
async function handleCreateLoan(req, res) {
  try {
    const body = req.body;

    if (!body.name || !body.contact || !body.address) {
      return res.status(400).json({ message: "Missing required borrower fields." });
    }

    const borrower = {
      name: body.name,
      contact: body.contact,
      address: body.address,
      loanAmount: Number(body.loanAmount) || 0,
      term: Number(body.term) || 0,
      interestRate: Number(body.interestRate) || 0,
      interestType: body.interestType || "monthly",
      nextDueDate: body.nextDueDate ? new Date(body.nextDueDate) : null,
      monthlyPayment: Number(body.monthlyPayment) || 0,
      createdAt: new Date(),
      payments: [],
      penalties: [],
      totalPenalties: 0,
      remainingBalance: calculateInitialBalance(
        Number(body.loanAmount) || 0, 
        Number(body.interestRate) || 0, 
        Number(body.term) || 0, 
        body.interestType || "monthly"
      ),
    };

    const database = await connectToDatabase();
    
    if (database && !useFileStorage) {
      // Use MongoDB
      const collection = database.collection("borrowers");
      const result = await collection.insertOne(borrower);
      console.log(`✅ Created borrower in MongoDB: ${result.insertedId}`);
      return res.status(201).json({ _id: result.insertedId, ...borrower });
    } else {
      // Use file storage
      borrower._id = generateId();
      const data = readData();
      data.borrowers.push(borrower);
      if (writeData(data)) {
        console.log(`✅ Created borrower in file storage: ${borrower._id}`);
        return res.status(201).json(borrower);
      } else {
        return res.status(500).json({ message: "Failed to save borrower" });
      }
    }
  } catch (err) {
    console.error('Error creating loan:', err);
    // Fallback to file storage
    try {
      const body = req.body;
      const borrower = {
        _id: generateId(),
        name: body.name,
        contact: body.contact,
        address: body.address,
        loanAmount: Number(body.loanAmount) || 0,
        term: Number(body.term) || 0,
        interestRate: Number(body.interestRate) || 0,
        interestType: body.interestType || "monthly",
        nextDueDate: body.nextDueDate ? new Date(body.nextDueDate) : null,
        monthlyPayment: Number(body.monthlyPayment) || 0,
        createdAt: new Date(),
        payments: [],
        penalties: [],
        totalPenalties: 0,
        remainingBalance: calculateInitialBalance(
          Number(body.loanAmount) || 0, 
          Number(body.interestRate) || 0, 
          Number(body.term) || 0, 
          body.interestType || "monthly"
        ),
      };
      const data = readData();
      data.borrowers.push(borrower);
      if (writeData(data)) {
        console.log(`✅ Fallback: Created borrower in file storage: ${borrower._id}`);
        return res.status(201).json(borrower);
      } else {
        return res.status(500).json({ message: "Failed to save borrower" });
      }
    } catch (fileErr) {
      console.error('File storage fallback failed:', fileErr);
      return res.status(500).json({ message: "Internal Server Error", error: fileErr.message });
    }
  }
}

// PUT loans handler - Handle payments and penalties
async function handleUpdateLoan(req, res) {
  try {
    const database = await connectToDatabase();
    const { id } = req.query;
    const body = req.body;

    if (!id) return res.status(400).json({ message: "Missing borrower id." });

    if (body.payment) {
      let borrower;
      
      if (database && !useFileStorage) {
        // MongoDB operation - validate ObjectId format
        if (!ObjectId || !ObjectId.isValid(id)) {
          return res.status(400).json({ message: "Invalid borrower ID format." });
        }
        
        const collection = database.collection("borrowers");
        borrower = await collection.findOne({ _id: new ObjectId(id) });
        if (!borrower) return res.status(404).json({ message: "Borrower not found." });
      } else {
        // File storage operation
        const data = readData();
        borrower = data.borrowers.find(b => b._id === id);
        if (!borrower) return res.status(404).json({ message: "Borrower not found." });
      }

      const paymentRecord = {
        amount: Number(body.payment.amount) || 0,
        date: body.payment.date ? new Date(body.payment.date) : new Date(),
        note: body.payment.note || "",
      };

      if (paymentRecord.amount <= 0) {
        return res.status(400).json({ message: "Payment amount must be greater than zero." });
      }

      // Calculate remaining balance
      const totalPayments = (borrower.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0) + paymentRecord.amount;
      const totalPenalties = borrower.totalPenalties || 0;
      const loanAmount = borrower.loanAmount || 0;
      
      let totalInterest = 0;
      if (borrower.interestRate && borrower.term) {
        const monthlyInterestRate = borrower.interestType === 'annually' 
          ? borrower.interestRate / 12 
          : borrower.interestRate;
        const monthlyInterest = loanAmount * (monthlyInterestRate / 100);
        totalInterest = monthlyInterest * borrower.term;
      }
      
      const newBalance = Math.max(loanAmount + totalInterest + totalPenalties - totalPayments, 0);

      if (database && !useFileStorage) {
        // MongoDB operation
        const collection = database.collection("borrowers");
        await collection.updateOne(
          { _id: new ObjectId(id) },
          {
            $push: { payments: paymentRecord },
            $set: { remainingBalance: newBalance },
          }
        );
      } else {
        // File storage operation
        const data = readData();
        const borrowerIndex = data.borrowers.findIndex(b => b._id === id);
        if (borrowerIndex === -1) return res.status(404).json({ message: "Borrower not found." });
        
        data.borrowers[borrowerIndex].payments = data.borrowers[borrowerIndex].payments || [];
        data.borrowers[borrowerIndex].payments.push(paymentRecord);
        data.borrowers[borrowerIndex].remainingBalance = newBalance;
        
        if (!writeData(data)) {
          return res.status(500).json({ message: "Failed to save payment" });
        }
      }

      console.log(`💵 Payment added for borrower: ${id}`);
      return res.json({ message: "Payment added successfully.", remainingBalance: newBalance });
    }

    if (body.penalty) {
      let borrower;
      
      if (database && !useFileStorage) {
        // MongoDB operation
        if (!ObjectId || !ObjectId.isValid(id)) {
          return res.status(400).json({ message: "Invalid borrower ID format." });
        }
        
        const collection = database.collection("borrowers");
        borrower = await collection.findOne({ _id: new ObjectId(id) });
        if (!borrower) return res.status(404).json({ message: "Borrower not found." });
      } else {
        // File storage operation
        const data = readData();
        borrower = data.borrowers.find(b => b._id === id);
        if (!borrower) return res.status(404).json({ message: "Borrower not found." });
      }

      const penaltyRecord = {
        amount: Number(body.penalty.amount) || 0,
        reason: body.penalty.reason || "Penalty",
        date: new Date(),
        type: "penalty"
      };

      const existingPenalties = (borrower.penalties || []).reduce((sum, p) => sum + (p.amount || 0), 0);
      const newTotalPenalties = existingPenalties + penaltyRecord.amount;
      
      // Calculate remaining balance
      const totalPayments = (borrower.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
      const loanAmount = borrower.loanAmount || 0;
      
      let totalInterest = 0;
      if (borrower.interestRate && borrower.term) {
        const monthlyInterestRate = borrower.interestType === 'annually' 
          ? borrower.interestRate / 12 
          : borrower.interestRate;
        const monthlyInterest = loanAmount * (monthlyInterestRate / 100);
        totalInterest = monthlyInterest * borrower.term;
      }
      
      const newBalance = loanAmount + totalInterest + newTotalPenalties - totalPayments;

      if (database && !useFileStorage) {
        // MongoDB operation
        const collection = database.collection("borrowers");
        await collection.updateOne(
          { _id: new ObjectId(id) },
          {
            $push: { penalties: penaltyRecord },
            $set: { 
              totalPenalties: newTotalPenalties,
              remainingBalance: newBalance 
            },
          }
        );
      } else {
        // File storage operation
        const data = readData();
        const borrowerIndex = data.borrowers.findIndex(b => b._id === id);
        if (borrowerIndex === -1) return res.status(404).json({ message: "Borrower not found." });
        
        data.borrowers[borrowerIndex].penalties = data.borrowers[borrowerIndex].penalties || [];
        data.borrowers[borrowerIndex].penalties.push(penaltyRecord);
        data.borrowers[borrowerIndex].totalPenalties = newTotalPenalties;
        data.borrowers[borrowerIndex].remainingBalance = newBalance;
        
        if (!writeData(data)) {
          return res.status(500).json({ message: "Failed to save penalty" });
        }
      }

      console.log(`⚠️ Penalty added for borrower: ${id}`);
      return res.json({ 
        message: "Penalty added successfully.", 
        remainingBalance: newBalance,
        totalPenalties: newTotalPenalties
      });
    }

    return res.status(400).json({ message: "Invalid request. Specify 'payment' or 'penalty'." });
  } catch (err) {
    console.error('Error updating loan:', err);
    return res.status(500).json({ message: "Internal Server Error", error: err.message });
  }
}

// DELETE loans handler
async function handleDeleteLoan(req, res) {
  try {
    const database = await connectToDatabase();
    const { id } = req.query;

    if (!id) return res.status(400).json({ message: "Missing borrower id." });

    if (database && !useFileStorage) {
      // MongoDB operation
      if (!ObjectId || !ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid borrower ID format." });
      }
      
      const collection = database.collection("borrowers");
      const result = await collection.deleteOne({ _id: new ObjectId(id) });
      
      if (result.deletedCount === 0) {
        return res.status(404).json({ message: "Borrower not found." });
      }
      
      console.log(`🗑️ Deleted borrower from MongoDB: ${id}`);
      return res.json({ message: "Borrower deleted successfully." });
    } else {
      // File storage operation
      const data = readData();
      const borrowerIndex = data.borrowers.findIndex(b => b._id === id);
      
      if (borrowerIndex === -1) {
        return res.status(404).json({ message: "Borrower not found." });
      }
      
      data.borrowers.splice(borrowerIndex, 1);
      
      if (!writeData(data)) {
        return res.status(500).json({ message: "Failed to delete borrower" });
      }
      
      console.log(`🗑️ Deleted borrower from file storage: ${id}`);
      return res.json({ message: "Borrower deleted successfully." });
    }
  } catch (err) {
    console.error('Error deleting loan:', err);
    return res.status(500).json({ message: "Internal Server Error", error: err.message });
  }
}