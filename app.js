var createError = require('http-errors');
var express = require('express');
var fileUpload = require('express-fileupload');
var path = require('path');
var exphbs = require('express-handlebars');
var session = require('express-session');
var mongoose = require('mongoose');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var methodOverride = require('method-override');
var crypto = require('crypto');
var bodyParser = require('body-parser');
const MongoStore = require("connect-mongo");
require('dotenv').config();


// 🔒 Security & Protection Packages
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');

// Get session secret from .env, else generate a strong random one
const sessionSecret =
  process.env.SESSION_SECRET || crypto.randomBytes(64).toString('hex');

var userRouter = require('./routes/user');
var adminRouter = require('./routes/admin');

var app = express();

// ====== MONGOOSE CONNECTION ======
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch((err) => console.error('❌ MongoDB Connection Failed:', err));

// ====== SECURITY MIDDLEWARE ======
app.disable('x-powered-by'); // Hide Express

app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],

      scriptSrc: [
        "'self'",
        "'unsafe-inline'",                // allow inline JS (needed for Bootstrap & jQuery init)
        "https://code.jquery.com",        // jQuery
        "https://cdn.jsdelivr.net",       // Bootstrap
        "https://checkout.razorpay.com"   // ✅ ADD THIS - Razorpay script
      ],

      scriptSrcElem: [                    // ✅ ADD THIS - for script elements specifically
        "'self'",
        "'unsafe-inline'",
        "https://code.jquery.com",
        "https://cdn.jsdelivr.net", 
        "https://checkout.razorpay.com"   // ✅ Razorpay script elements
      ],

      styleSrc: [
        "'self'",
        "'unsafe-inline'",                // allow inline CSS
        "https://cdn.jsdelivr.net",       // Bootstrap
        "https://fonts.googleapis.com",   // Google Fonts
        "https://cdnjs.cloudflare.com"    // Font Awesome CSS
      ],

      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com",      // Google Fonts
        "https://cdn.jsdelivr.net",       // Bootstrap Icons
        "https://cdnjs.cloudflare.com"    // Font Awesome
      ],

      imgSrc: [
        "'self'",
        "data:",
        "https://res.cloudinary.com",     // Cloudinary
        "https://cdn.jsdelivr.net"        // Bootstrap Icons fallback
      ],

      connectSrc: [
        "'self'",
        "https://res.cloudinary.com",
        "https://cdn.jsdelivr.net",       // ✅ FIX TYPO - was "cdn.jsdeliver.net"
        "https://api.razorpay.com"        // ✅ ADD THIS - Razorpay API calls
      ],

      frameSrc: [                         // ✅ ADD THIS - for Razorpay iframe/popup
        "'self'",
        "https://api.razorpay.com"        // Razorpay payment frame
      ],

      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  })
);

// Limit repeated requests
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 100, // limit each IP
  message: 'Too many requests, try again later.',
});
app.use(limiter);

// CORS (allow only your domain in production)
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN || 'https://shalom-garden.onrender.com',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  })
);

// Prevent NoSQL Injection & XSS
app.use(mongoSanitize());
app.use(xss());

app.post("/razorpay/webhook", 
  bodyParser.raw({ type: 'application/json' }), 
  require("./routes/webhook")
);

// ====== BASIC MIDDLEWARE ======
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ====== HANDLEBARS SETUP ======
app.engine(
  'hbs',
  exphbs.engine({
    extname: 'hbs',
    defaultLayout: 'main',
    runtimeOptions: {
      allowProtoPropertiesByDefault: true,
      allowProtoMethodsByDefault: true,
    },
    layoutsDir: __dirname + '/views/layouts/',
    partialsDir: __dirname + '/views/partials/',
    helpers: {
      formatDate: function (date) {
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        return new Date(date).toLocaleDateString(undefined, options);
      },
      multiply: function (price, qty) {
        return price * qty;
      },
      eq: function (a, b) {
        return a === b;
      },
      add: function (a, b) {
        return a + b;
      },
      times: function (n, block) {
        let accum = '';
        for (let i = 0; i < n; ++i) accum += block.fn(i);
        return accum;
      },
      gte: function (a, b) {
    return a >= b;
  }

    },
  })
);

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

// Trust proxy for Render/other hosting services
app.set('trust proxy', 1);

// ====== SESSION SETUP ======
app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      collectionName: "sessions",
    }),
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 1000 * 60 * 60, // 1 hour
    },
  })
);


// ====== OTHER MIDDLEWARE ======
app.use(methodOverride('_method'));
app.use(
  fileUpload({
    useTempFiles: true,
    tempFileDir: '/tmp/',
    createParentPath: true,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
    abortOnLimit: true,
    safeFileNames: true,
    preserveExtension: true,
  })
);
app.use(logger('dev'));
app.use(cookieParser());

// ====== ROUTES ======
app.use('/', userRouter);
app.use('/admin', adminRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.status(err.status || 500);
  res.render('error');
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port http://localhost:${PORT}`);
});

module.exports = app;
