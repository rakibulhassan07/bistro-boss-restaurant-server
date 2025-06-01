const express =require('express')
const app=express();
require('dotenv').config();
const cors = require('cors');
const jwt =require('jsonwebtoken');
const port = process.env.PORT || 5000;

//middleware 
app.use(cors())
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.lf0gvrt.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const menuCollection = client.db('bistroDb').collection('menu')
    const reviewsCollection = client.db('bistroDb').collection('reviews')
    const usersCollection = client.db('bistroDb').collection('users')
    const cartsCollection = client.db('bistroDb').collection('carts')
    //jwt related Api
    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.send({ token });
    })
    // Middleware to verify JWT token
    const vferiyToken = (req, res, next) => {
      console.log(req.headers)
      if (!req.headers.authorization) {
        return res.status(401).send({ error: true, message: 'unauthorized access' });
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
         return res.status(401).send({ error: true, message: 'unauthorized access' });
        }
        req.decoded = decoded; // Store the decoded token in the request object
        next(); // Call the next middleware or route handler
      });
      //next();
    }
    //admin verification middleware
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== 'admin') {
        return res.status(403).send({ error: true, message: 'Forbidden access' });
      }
      next();
    }
    // Users related APIs 

     app.get('/users',vferiyToken,verifyAdmin, async(req, res) => {
      console.log(req.headers)
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.post('/users', async(req, res) => {
      const user = req.body;
      // Check if user already exists
      const existingUser = await usersCollection.findOne({ email: user.email });
      if (existingUser) {
        return res.send({ message: 'User already exists',insertedId:null });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

   
    app.get('/users/admin/:email',vferiyToken, async(req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        return res.status(403).send({ error: true, message: 'Forbidden access' });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      res.send({ admin: isAdmin });
    });

    app.patch('/users/admin/:id',vferiyToken,verifyAdmin, async(req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role :'admin' // or 'user', depending on your logic
        }
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.delete('/users/:id',vferiyToken,verifyAdmin, async(req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    });

    // Existing endpoints
    app.get('/menu', async(req,res)=>{
        const result=await menuCollection.find().toArray();
        res.send(result);
    })
    // Add a new menu item
    app.post('/menu',vferiyToken,verifyAdmin, async(req,res)=>{
        const item=req.body;
        const result=await menuCollection.insertOne(item);
        res.send(result);
    })
    app.get('/reviews', async(req,res)=>{
        const result=await reviewsCollection.find().toArray();
        res.send(result);
    })
    app.get('/carts', async(req,res)=>{
        const email = req.query.email;
        let query = {email: email};
        const result=await cartsCollection.find(query).toArray();
        res.send(result);
    })
    app.post('/carts', async(req,res)=>{
        const item=req.body;
        const result=await cartsCollection.insertOne(item);
        res.send(result);
    })
    app.delete('/carts/:id', async(req,res)=>{
        const id=req.params.id;
        const query={_id: new ObjectId(id)};
        const result=await cartsCollection.deleteOne(query);
        res.send(result);
    })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    //await client.close();
  }
}
run().catch(console.dir);

app.get('/',(req,res)=>{
    res.send('boss is sitting')
})

app.listen(port,()=>{
    console.log(`Bistro boss is sitting on port ${port}`);
})