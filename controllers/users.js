const User = require('../models/user');
import { Resend } from 'resend';
const resend = new Resend('re_NWMx3czy_5fm2q1hrJ1bKkgFh5no1fdyD');

module.exports.renderRegister = (req, res) => {
    res.render('users/register');
}

module.exports.register = async (req, res, next) => {
    try {
        const { email, username, password } = req.body;
        const user = new User({ email, username });
        const registeredUser = await User.register(user, password);
        // Send a welcome email to the user
        try {
            await resend.emails.send({
                from: 'Acme <onboarding@resend.dev>',
                to: [`${email}`],
                subject: 'Welcome to Our Platform',
                html: '<strong>Welcome! It works!</strong>',
            });
            console.log('Welcome email sent successfully.');
        } catch (emailError) {
            console.error('Error sending welcome email:', emailError);
        }
        req.login(registeredUser, err => {
            if (err) return next(err);
            req.flash('success', 'Welcome to Yelp Camp!');
            res.redirect('/campgrounds');
        })
    } catch (e) {
        req.flash('error', e.message);
        res.redirect('register');
    }
}

module.exports.renderLogin = (req, res) => {
    res.render('users/login');
}

module.exports.login = (req, res) => {
    req.flash('success', 'welcome back!');
    const redirectUrl = req.session.returnTo || '/campgrounds';
    delete req.session.returnTo;
    res.redirect(redirectUrl);
}

module.exports.logout = (req, res) => {
    req.logout();
    // req.session.destroy();
    req.flash('success', "Goodbye!");
    res.redirect('/campgrounds');
}
