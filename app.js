const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const dotenv = require('dotenv');

dotenv.config();

// Middleware to parse JSON request body
app.use(bodyParser.json());


// Your routes and other middleware go here

//Importing Routes
const userRoutes = require("./routes/routes")


//Route Middlewares
app.use("/", userRoutes);

app.get('/hello', (req, res) => {
  res.json({ message: 'Hello World!' });
})

// //Handling Requests For Non-Existing Endpoints
// app.use((req, res, next) => {
//     res.status(404).send({ message: "Hey! Please double-check the API endpoint." });
//   });



const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});