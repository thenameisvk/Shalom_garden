module.exports = {
    ensureAdmin: (req, res, next) => {
    if (req.session && req.session.isAdmin) {
      return next();
    }
    res.redirect('/admin/login');
  },
  ensureUser: (req, res, next) => {
    if (req.session && req.session.isLoggedIn) {
      next();
    } else {
      res.redirect('/login');
    }
  }
};
