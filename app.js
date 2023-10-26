const express = require('express');
const mongoose = require('mongoose');
const _ = require('lodash');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');

dotenv.config(); // Load environment variables from .env file

const app = express(); // Initialize Express application
const port = process.env.PORT // Set the port for the server

app.set('view engine', 'ejs'); // Set EJS as the view engine
app.use(bodyParser.urlencoded({ extended: true })); // Parse URL-encoded bodies
app.use(express.static('public')); // Serve static files from the 'public' directory

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}); // Connect to MongoDB using the provided URI

// Define mongoose schemas and models
const itemsSchema = new mongoose.Schema({
  name: String
});

const Item = mongoose.model('Item', itemsSchema); // Create Item model

const item1 = new Item({
  name: 'Welcome to your To-do List 💡'
});

const item2 = new Item({
  name: 'Hit the + button to add a new item.'
});

const item3 = new Item({
  name: 'Click on checkbox to delete an item.'
});

const defaultItems = [item1, item2, item3]; // Default items for the To-do List

const listSchema = {
  name: String,
  items: [itemsSchema]
};

const List = mongoose.model('List', listSchema); // Create List model

// Error handling middleware
app.use((err, req, res, next) => {
  // Log the error for debugging purposes
  console.error(err.stack);

  // Handle specific types of errors and send appropriate responses
  if (err instanceof mongoose.Error.ValidationError) {
    // Mongoose validation error (e.g., invalid data)
    return res.status(400).json({ error: err.message });
  } else if (err instanceof mongoose.Error.CastError) {
    // Mongoose cast error (e.g., invalid ObjectId)
    return res.status(400).json({ error: 'Invalid ID format' });
  } else if (err instanceof mongoose.Error.DocumentNotFoundError) {
    // Document not found error
    return res.status(404).json({ error: 'Resource not found' });
  } else {
    // Generic internal server error for unhandled errors
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Routes and route handlers
app.get('/', async function(req, res) {
  try {
    // Find items from the database
    const foundItems = await Item.find({});

    // Check if there are no items, insert default items
    if (foundItems.length === 0) {
      await Item.insertMany(defaultItems);
      console.log('Successfully saved initial entries to the To-Do-List DataBase');
    } else {
      // Render the list page with found items
      res.render('list', { listTitle: 'Today', newListItems: foundItems });
    }
  } catch (err) {
    console.error(err);
    // Return an error response to the client
    res.status(500).send('Internal Server Error');
  }
});

app.get('/:customListName', async function(req, res) {
  const customListName = _.capitalize(req.params.customListName);

  try {
    // Find a custom list by name
    let foundList = await List.findOne({ name: customListName });

    if (!foundList) {
      // Create a new List only if it doesn't exist
      const list = new List({
        name: customListName,
        items: defaultItems
      });

      foundList = await list.save();
      console.log('New list created!');
    } else {
      console.log('List already exists!');
      // Handle the case when the list already exists, if needed
    }

    // Respond to the client after the operation is completed
    res.render('list', { listTitle: foundList.name, newListItems: foundList.items });
  } catch (err) {
    console.error(err);
    // Handle errors and send an appropriate response to the client
    res.status(500).send('Internal Server Error');
  }
});

app.post('/', async function(req, res) {
  const itemName = req.body.newItem;
  const listName = req.body.list;

  const item = new Item({
    name: itemName
  });

  try {
    if (listName === 'Today') {
      // Save item to the default list (Today)
      await item.save();
      // Redirect to the home page after successful save
      res.redirect('/');
    } else {
      // Save item to a custom list
      let foundList = await List.findOne({ name: listName });
      if (!foundList) {
        // Create a new custom list if it doesn't exist
        const newList = new List({
          name: listName,
          items: [item]
        });
        foundList = await newList.save();
      } else {
        foundList.items.push(item);
        foundList = await foundList.save();
      }
      // Redirect to the custom list page after successful save
      res.redirect('/' + listName);
    }
  } catch (err) {
    // Handle the error, send an error response to the client
    console.error(err);
    res.status(500).send('Error occurred while saving item.');
  }
});

app.post('/delete', function(req, res) {
  const checkedItemId = req.body.checkbox;
  const listName = req.body.listName;

  if (listName === 'Today') {
    // Delete item from the default list (Today)
    Item.findByIdAndDelete(checkedItemId)
      .then(() => {
        console.log('Successfully deleted checked item.');
        res.redirect('/');
      })
      .catch(err => {
        console.error('Error deleting item:', err);
        // Send an internal server error response
        res.status(500).send('Internal Server Error');
      });
  } else {
    // Delete item from a custom list
    List.findOneAndUpdate({ name: listName }, { $pull: { items: { _id: checkedItemId } } })
      .then(() => {
        console.log('Successfully deleted checked item from custom list.');
        // Redirect to the custom list page after successful delete
        res.redirect('/' + listName);
      })
      .catch(err => {
        console.error('Error deleting item from custom list:', err);
        // Send an internal server error response
        res.status(500).send('Internal Server Error');
      });
  }
});

app.listen(process.env.PORT, () => {
  console.log(`Server started on port ${port}!!`);
});
