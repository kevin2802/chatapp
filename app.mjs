import './config.mjs';
import './db.mjs';
import cors from 'cors'
import { createServer } from 'http';
import { Server } from 'socket.io';
import express from 'express'
import session from 'express-session';
import path from 'path'
import mongoose from 'mongoose';
import passport from 'passport';
import { fileURLToPath } from 'url';
import { Strategy as LocalStrategy } from 'passport-local';
import {randomUUID} from 'crypto';
const User = mongoose.model('User');
const Message = mongoose.model('Message');
const Chatroom = mongoose.model('Chatroom');
const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);//setup

app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'hbs');

app.use(express.urlencoded({ extended: false }));
const sid = randomUUID();//use crypto to create sid
//session
app.use(session({
  secret:sid,
  resave:false,
  saveUninitialized:false
})
);
app.use(cors());

const httpServer = createServer(app);
//socketio server
const io = new Server(httpServer);
app.set('io', io);


//passport
app.use(passport.initialize())
app.use(passport.session())

passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

//middleware
const isAuthenticated = (req, res, next) => {//make sure user is authenticated before allowing access
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login'); 
};
//using passport to register new user 
app.post('/register', (req, res) => {
  User.register(new User({ username: req.body.username }), req.body.password, (err, user) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error registering user' });
    }
    passport.authenticate('local')(req, res, () => {
      res.render('login');
    });
  });
});

//io 
io.on('connection', async (socket) => {


  //const globalMessages = await Message.find({ chatRoom: 'global' }).exec();
  //socket.emit('chat history', globalMessages);

  socket.on('disconnect', () => {
    //someone disconeccted
    socket.leaveAll();
    io.to('global').emit('chat message', { user: "system", content: 'A user has left the chat' });

  });

  socket.on('chat message', (msg) => {//listen for chats
    socket.join('global');//join global
    const newMessage = new Message({
      user: msg.user, // use the actual username here
      chatRoom: 'global',//global chat
      content: msg.content,
      createdAt: new Date()
    });

    newMessage.save();
        
      io.to('global').emit('chat message', msg);//send message to everyone in global
    });

    socket.on('join private room', async (msg) => {

      const privateRoom = `${msg.user}-${msg.receiver}`;
      //join the private room
      socket.join(privateRoom);
      const privateMessages = await Message.find({ chatRoom: privateRoom }).exec();
      console.log(privateMessages)
      socket.emit('chat history', privateMessages);
      io.to(privateRoom).emit('system message', { content: `You joined a private room with ${msg.user}` });
  });

    socket.on('private message',(msg)=>{//private chats
      const newMessage = new Message({
        user: msg.user, // use the actual username here
        chatRoom: msg.id + msg.receiver,//privateChat composed of both users
        content: msg.content,
        createdAt: new Date()
      });
      newMessage.save();
      //send messaages to room
      io.to(`${msg.id}-${msg.receiver}`).emit('private message', { user: msg.receiver, content: msg.content, isSender: true });
      io.to(`${msg.receiver}-${msg.id}`).emit('private message', { user: msg.user, content: msg.content, isSender: false });
    })

    
});


//routers
app.post('/private',isAuthenticated,(req,res)=>{
  res.redirect('private')
})

app.get('/private', isAuthenticated, async (req, res) => {
  try{
    const users = await User.find({ _id: { $ne: req.user._id } }, 'username').exec();
    
    res.render('private', {
        username: req.user.username,
        userid:req.user.id,
        users: users.map(user => ({ _id: user._id.toString(), username: user.username }))
    });
  }
  catch(err){
    console.log("error")
    res.status(500).json({ error: 'Internal Server Error' });
  }
  
});

app.post('/cat',isAuthenticated,(req,res)=>{
  res.render('cat',{username: req.user.username,message:req.body.message,response:'meow'})
})
app.get('/global',isAuthenticated,(req,res)=>{
  res.render('global', { username: req.user.username });//sends username to chat
})
app.get('/home', isAuthenticated, (req, res) => {
  res.render('home', { username: req.user.username });
});
app.get('/cat', isAuthenticated, (req, res) => {
  res.render('cat');
});
app.get('/register', (req, res) => {
  res.render('register'); 
});
app.post('/login', passport.authenticate('local',{ failureRedirect: '/login', failureMessage: true }), (req, res) => {//added check for authentication
  res.redirect('home');
});

app.get('/', (req, res) => {
  res.render('login'); 
});
app.get('/login', (req, res) => {
    res.render('login'); 
  });


httpServer.listen(process.env.PORT || 3000, () => {
  console.log('running');
});
