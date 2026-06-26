const router = require('express').Router();
const { registerUser, loginUser, viewProfile, logoutUser, deleteAccount, uploadAvatar, getAvatar, removeAvatar } = require('../controllers/user.controller.js');
const { isLoggedIn } = require('../middlewares/auth.middleware.js');
const { registerSchema, loginSchema } = require('../validations/user.validation.js');
const validate = require('../middlewares/validation.middleware.js');
const upload = require('../config/multer.js');

router.post('/register', validate(registerSchema), registerUser);
router.post('/login', validate(loginSchema), loginUser);
router.get('/profile', isLoggedIn, viewProfile);
router.post('/logout', isLoggedIn, logoutUser);
router.delete('/delete', isLoggedIn, deleteAccount);

// Avatar routes
router.post('/avatar', isLoggedIn, upload.single('avatar'), uploadAvatar);
router.get('/avatar', isLoggedIn, getAvatar);
router.delete('/avatar', isLoggedIn, removeAvatar);

module.exports = router;