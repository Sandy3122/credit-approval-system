const express = require('express');
const router = express.Router();

const {register} = require("../controllers/register");
const { checkEligibility } = require("../controllers/checkEligibility");
const { createLoan } = require("../controllers/createLoan");
const { viewLoan } = require("../controllers/viewLoan");
const { makePayment } = require("../controllers/makePayment");
const { viewStatement } = require("../controllers/viewStatement");


// Creating routes
router.post("/register", register); 
router.post("/check-eligibility", checkEligibility);
router.post("/create-loan", createLoan);
router.get("/view-loan/:loan_id", viewLoan);
router.post("/make-payment/:customer_id/:loan_id", makePayment);
router.get("/view-statement/:customer_id/:loan_id", viewStatement);


//Exporting User Routes
module.exports = router;