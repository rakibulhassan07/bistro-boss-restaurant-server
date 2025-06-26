const express =require('express')
const app=express();
require('dotenv').config();
const cors = require('cors');
const port = process.env.PORT || 5000;
const jwt =require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
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
    // Create a new collection for payments
    const paymentsCollection = client.db('bistroDb').collection('payments');
    // Users related APIs 

    //jwt related Api
    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.send({ token });
    })
    // Middleware to verify JWT token
    const vferiyToken = (req, res, next) => {
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
    
    app.post('/menu',vferiyToken,verifyAdmin, async(req,res)=>{
        const item=req.body;
        if (item._id) delete item._id;
        const result=await menuCollection.insertOne(item);
        res.send(result);
    })
    // Existing endpoints
    app.get('/menu', async(req,res)=>{
        const result=await menuCollection.find().toArray();
        res.send(result);
    })
    // Get a single menu item by ID
    app.get('/menu/:id', async(req,res)=>{
        const id=req.params.id;
        const query={_id: new ObjectId(id)};
        const result=await menuCollection.findOne(query);
        res.send(result);
    })
    // Add a new menu item
  
    //add delete menu item
    app.delete('/menu/:id',vferiyToken,verifyAdmin, async(req,res)=>{
        const id=req.params.id;
        const query={_id: new ObjectId(id)};
        const result=await menuCollection.deleteOne(query);
        res.send(result);
    })
    //update menu item
    app.patch('/menu/:id',vferiyToken,verifyAdmin, async(req,res)=>{
        const id=req.params.id;
        const item=req.body;
        const filter={_id: new ObjectId(id)};
        const updateDoc={
            $set:{
                name:item.name,
                price:item.price,
                image:item.image,
                category:item.category,
                recipe:item.recipe
                 
            }
        }
        const result=await menuCollection.updateOne(filter,updateDoc);
        res.send(result);
    })
    //reviews related api
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

    // Create a payment intent
    app.post('/create-payment-intent', async (req, res) => {
      const { price } = req.body;
      const amount =parseInt(price * 100); // Convert to cents
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card'],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });
      
    app.post('/payments', async(req,res)=>{
      const payment = req.body;
      const insertResult = await paymentsCollection.insertOne(payment);
      
      // Update the cart items to mark them as paid
      const query = { _id: { $in: payment.cartId.map(id => new ObjectId(id)) } };
      const updateResult = await cartsCollection.deleteMany(query);
      
      res.send({ insertResult, updateResult });
    });
   
    app.get('/payments/:email',vferiyToken, async (req, res) => {
      const query = { email: req.params.email };
      if (req.params.email !== req.decoded.email) {
        return res.status(403).send({message: 'Forbidden access' });
      }
      const result = await paymentsCollection.find(query).toArray();
      res.send(result);
    });
    
    app.get('/admin-stats', vferiyToken, verifyAdmin, async (req, res) => {
      const usersCount = await usersCollection.estimatedDocumentCount();
      const productsCount = await menuCollection.estimatedDocumentCount();
      const ordersCount = await paymentsCollection.estimatedDocumentCount();
     

      // Calculate total revenue
       const result = await paymentsCollection.aggregate([
         {
           $group: 
           { _id: null, total: { $sum: "$price" } 
          } 
        }
        ]).toArray();

         const totalRevenue = result.length > 0 ? result[0]?.total : 0;

      res.send({
        users: usersCount,
        products: productsCount,
        orders: ordersCount,
        revenue: totalRevenue,
      });
    })

      app.get('/order-stats', vferiyToken, verifyAdmin, async(req, res) =>{
      const result = await paymentsCollection.aggregate([
        {
          $unwind:'$menuItems'
        },
        {
          $addFields: {
            menuItemObjectId: { $toObjectId: "$menuItems" }
          }
        },
        {
          $lookup: {
            from: 'menu',
            localField: 'menuItemObjectId',
            foreignField: '_id',
            as: 'menuItemDetails'
          }
        },
        {
          $unwind: '$menuItemDetails'
        },
        {
          $group:{
            _id: '$menuItemDetails.category',
            quantity: { $sum: 1 },
            revenue: { $sum: '$menuItemDetails.price' },   
          }
        },
        {
          $project: {
            _id: 0,
            category: '$_id',
            quantity: '$quantity',
            revenue: '$revenue'
          }
        }
       
      ]).toArray();

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