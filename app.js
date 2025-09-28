var createError = require('http-errors');
var express = require('express');
var fileUpload = require('express-fileupload');
var path = require('path');
var exphbs = require('express-handlebars');
var session = require('express-session');
var mongoose = require('mongoose');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
// Add method-override middleware at the top of admin.js
var methodOverride = require('method-override');
require('dotenv').config();

var userRouter = require('./routes/user');
var adminRouter = require('./routes/admin');

var app = express();

// ====== MONGOOSE CONNECTION ======
mongoose.connect('mongodb://127.0.0.1:27017/shalom_garden', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB Connected Successfully'))
.catch(err => console.error('❌ MongoDB Connection Failed:', err));

// ====== MIDDLEWARE ======
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));


app.engine('hbs', exphbs.engine({
  extname: 'hbs',
  defaultLayout: 'main',
   runtimeOptions: {
      allowProtoPropertiesByDefault: true,
      allowProtoMethodsByDefault: true
    },
  layoutsDir: __dirname + '/views/layouts/',
  partialsDir: __dirname + '/views/partials/',
  helpers: {
  formatDate: function(date) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(date).toLocaleDateString(undefined, options);
  },
  multiply: function(price, qty) {
    return price * qty;
  },
  eq: function(a, b) {
    return a === b;
  },
  add: function(a, b) {
    return a + b;
  },
  times: function(n, block) {
    let accum = '';
    for(let i = 0; i < n; ++i)
        accum += block.fn(i);
    return accum;
},
}
}));

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');


app.use(
  session({
    secret: 'shalomgarden_secret_key', // change to strong secret
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 } // 1 hour
  })
);
app.use(methodOverride('_method'));
app.use(fileUpload());
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', userRouter);
app.use('/admin', adminRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port http://localhost:${PORT}`);
});
module.exports = app;
