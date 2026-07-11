const router = require('express').Router();
const uc = require('../controllers/user.controller.js');
const { isLoggedIn } = require('../middlewares/auth.middleware.js');
const { registerSchema, loginSchema } = require('../validations/user.validation.js');
const validate = require('../middlewares/validation.middleware.js');
const upload = require('../config/multer.js');

router.post('/register', validate(registerSchema), uc.registerUser);
router.post('/login', validate(loginSchema), uc.loginUser);
router.get('/profile', isLoggedIn, uc.viewProfile);
router.post('/logout', isLoggedIn, uc.logoutUser);
router.delete('/delete', isLoggedIn, uc.deleteAccount);

// Avatar routes
router.post('/avatar', isLoggedIn, upload.single('avatar'), uc.uploadAvatar);
router.delete('/avatar', isLoggedIn, uc.removeAvatar);

module.exports = router;