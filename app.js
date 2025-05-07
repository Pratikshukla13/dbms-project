// Loading and Using Modules Required
const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const ejs = require("ejs");
const fileUpload = require("express-fileupload");
const { v4: uuidv4 } = require("uuid");
const mysql = require("mysql2");
const http = require('http');
const socketIo = require('socket.io');

// Initialize Express App
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Store connected users
const connectedUsers = new Map();

// Set View Engine and Middleware
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(express.json());
app.use(cookieParser());
app.use(fileUpload());

// Database Connection
const connection = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "Rudraksh2005.",
  database: "foodorderingwesitedb",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

connection.connect((err) => {
  if (err) {
    console.error('Error connecting to the database:', err);
    return;
  }
  console.log('Successfully connected to the database');
});

// Add this function after the database connection setup
function createDeliveredOrdersTable() {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS delivered_orders (
      order_id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      item_id VARCHAR(255) NOT NULL,
      quantity INT NOT NULL,
      price DECIMAL(10,2) NOT NULL,
      datetime DATETIME NOT NULL,
      status VARCHAR(20) DEFAULT 'delivered',
      FOREIGN KEY (user_id) REFERENCES users(user_id),
      FOREIGN KEY (item_id) REFERENCES menu(item_id)
    )
  `;

  connection.query(createTableQuery, function(error) {
    if (error) {
      console.error('Error creating delivered_orders table:', error);
    } else {
      console.log('delivered_orders table created or already exists');
    }
  });
}

// Call the function when the server starts
createDeliveredOrdersTable();

// Add this function after the database connection setup
function createOrderStatusTrigger() {
  const createTriggerQuery = `
    CREATE TRIGGER IF NOT EXISTS after_order_status_update
    AFTER UPDATE ON orders
    FOR EACH ROW
    BEGIN
      IF NEW.status != OLD.status THEN
        INSERT INTO order_notifications (
          order_id,
          user_id,
          old_status,
          new_status,
          notification_time
        ) VALUES (
          NEW.order_id,
          NEW.user_id,
          OLD.status,
          NEW.status,
          NOW()
        );
      END IF;
    END;
  `;

  connection.query(createTriggerQuery, function(error) {
    if (error) {
      console.error('Error creating order status trigger:', error);
    } else {
      console.log('Order status trigger created successfully');
    }
  });
}

// Add this function to create the notifications table
function createNotificationsTable() {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS order_notifications (
      notification_id INT AUTO_INCREMENT PRIMARY KEY,
      order_id VARCHAR(255) NOT NULL,
      user_id VARCHAR(255) NOT NULL,
      old_status VARCHAR(20),
      new_status VARCHAR(20),
      notification_time DATETIME NOT NULL,
      is_read BOOLEAN DEFAULT FALSE,
      FOREIGN KEY (order_id) REFERENCES orders(order_id),
      FOREIGN KEY (user_id) REFERENCES users(user_id)
    )
  `;

  connection.query(createTableQuery, function(error) {
    if (error) {
      console.error('Error creating notifications table:', error);
    } else {
      console.log('Notifications table created successfully');
      createOrderStatusTrigger();
    }
  });
}

// Call the function when the server starts
createNotificationsTable();

// Add this function to check payment modes
function checkPaymentModes() {
  connection.query(
    "SELECT * FROM payment_modes",
    function(error, results) {
      if (error) {
        console.error('Error checking payment modes:', error);
      } else {
        console.log('Payment modes in database:', results);
      }
    }
  );
}

// Call this function after creating the table
function createPaymentModesTable() {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS payment_modes (
      order_id VARCHAR(255) PRIMARY KEY,
      payment_mode ENUM('UPI', 'Net Banking', 'COD') NOT NULL,
      payment_status ENUM('Pending', 'Completed', 'Failed') DEFAULT 'Pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(order_id)
    )
  `;

  connection.query(createTableQuery, function(error) {
    if (error) {
      console.error('Error creating payment_modes table:', error);
    } else {
      console.log('payment_modes table created or already exists');
    }
  });
}

// Call the function when the server starts
createPaymentModesTable();

/*****************************  User-End Portal ***************************/

// Routes for User Sign-up, Sign-in, Home Page, Cart, Checkout, Order Confirmation, My Orders, and Settings
app.get("/", renderIndexPage);
app.get("/signup", renderSignUpPage);
app.post("/signup", signUpUser);
app.get("/signin", renderSignInPage);
app.post("/signin", signInUser);
app.get("/homepage", renderHomePage);
app.get("/cart", renderCart);
app.post("/cart", updateCart);
app.post("/checkout", checkout);
app.get("/confirmation", renderConfirmationPage);
app.get("/myorders", renderMyOrdersPage);
app.get("/settings", renderSettingsPage);
app.post("/address", updateAddress);
app.post("/contact", updateContact);
app.post("/password", updatePassword);

/***************************************** Admin End Portal ********************************************/
// Routes for Admin Sign-in, Admin Homepage, Adding Food, Viewing and Dispatching Orders, Changing Price, and Logout
app.get("/admin_signin", renderAdminSignInPage);
app.post("/admin_signin", adminSignIn);
app.get("/adminHomepage", renderAdminHomepage);
app.get("/admin_addFood", renderAddFoodPage);
app.post("/admin_addFood", addFood);
app.get("/admin_view_dispatch_orders", renderViewDispatchOrdersPage);
app.post("/admin_view_dispatch_orders", dispatchOrders);
app.get("/admin_change_price", renderChangePricePage);
app.post("/admin_change_price", changePrice);
app.get("/logout", logout);

/***************************** Route Handlers ***************************/

// Index Page
function renderIndexPage(req, res) {
  res.render("index");
}

// User Sign-up
function renderSignUpPage(req, res) {
  res.render("signup");
}

function signUpUser(req, res) {
  const { name, address, email, mobile, password } = req.body;
  connection.query(
    "INSERT INTO users (user_name, user_address, user_email, user_password, user_mobileno) VALUES (?, ?, ?, ?, ?)",
    [name, address, email, password, mobile],
    function (error, results) {
      if (error) {
        console.log(error);
      } else {
        res.render("signin");
      }
    }
  );
}

// User Sign-in

function renderSignInPage(req, res) {
  res.render("signin");
}

function signInUser(req, res) {
  const { email, password } = req.body;
  connection.query(
    "SELECT user_id, user_name, user_email, user_password FROM users WHERE user_email = ?",
    [email],
    function (error, results) {
      if (error || !results.length || results[0].user_password !== password) {
        res.render("signin");
      } else {
        const { user_id, user_name } = results[0];
        res.cookie("user_cookuid", user_id, { 
          maxAge: 24 * 60 * 60 * 1000, // 24 hours
          httpOnly: true,
          secure: false // Set to true in production with HTTPS
        });
        res.cookie("user_cookuname", user_name, { 
          maxAge: 24 * 60 * 60 * 1000, // 24 hours
          httpOnly: true,
          secure: false // Set to true in production with HTTPS
        });
        res.redirect("/homepage");
      }
    }
  );
}

// Render Home Page
function renderHomePage(req, res) {
  const userId = req.cookies.user_cookuid;
  const userName = req.cookies.user_cookuname;
  console.log('Rendering homepage for user:', { userId, userName });

  connection.query(
    "SELECT user_id, user_name FROM users WHERE user_id = ? AND user_name = ?",
    [userId, userName],
    function (error, results) {
      if (error) {
        console.error('Error checking user:', error);
        res.render("signin");
        return;
      }

      if (!results.length) {
        console.log('User not found, redirecting to signin');
        res.render("signin");
        return;
      }

      // Use a cursor to fetch unread notifications
      const cursorQuery = `
        DECLARE done INT DEFAULT FALSE;
        DECLARE notification_id INT;
        DECLARE order_id VARCHAR(255);
        DECLARE old_status VARCHAR(20);
        DECLARE new_status VARCHAR(20);
        DECLARE notification_time DATETIME;
        
        DECLARE notification_cursor CURSOR FOR
          SELECT n.notification_id, n.order_id, n.old_status, n.new_status, n.notification_time
          FROM order_notifications n
          WHERE n.user_id = ? AND n.is_read = FALSE
          ORDER BY n.notification_time DESC;
        
        DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
        
        OPEN notification_cursor;
        
        read_loop: LOOP
          FETCH notification_cursor INTO notification_id, order_id, old_status, new_status, notification_time;
          IF done THEN
            LEAVE read_loop;
          END IF;
          
          -- Emit notification
          SELECT CONCAT('Your order #', order_id, ' status changed from ', old_status, ' to ', new_status) INTO @message;
          
          -- Mark as read
          UPDATE order_notifications SET is_read = TRUE WHERE notification_id = notification_id;
        END LOOP;
        
        CLOSE notification_cursor;
      `;

      connection.query(cursorQuery, [userId], function(error, results) {
        if (error) {
          console.error('Error processing notifications:', error);
        }

        // Fetch menu items
        connection.query("SELECT * FROM menu", function (error, menuResults) {
          if (error) {
            console.error('Error fetching menu items:', error);
            res.render("signin");
            return;
          }

          console.log('Found menu items:', menuResults.length);
            res.render("homepage", {
              username: userName,
              userid: userId,
            items: menuResults,
            });
        });
      });
    }
  );
}

// Render Cart Page
function renderCart(req, res) {
  try {
    const userId = req.cookies.user_cookuid;
    const userName = req.cookies.user_cookuname;

    if (!userId || !userName) {
      return res.render("signin");
    }

  connection.query(
    "SELECT user_id, user_name FROM users WHERE user_id = ? AND user_name = ?",
    [userId, userName],
    function (error, results) {
        if (error) {
          console.error('Error checking user:', error);
          return res.render("signin");
        }

        if (!results || !results.length) {
          return res.render("signin");
        }

        res.render("cart", {
          username: userName,
          userid: userId,
          items: citemdetails || [],
          item_count: item_in_cart || 0,
        });
    }
  );
  } catch (error) {
    console.error('Error in renderCart:', error);
    res.render("signin");
  }
}

// Update Cart
function updateCart(req, res) {
  try {
  const cartItems = req.body.cart;
    if (!Array.isArray(cartItems)) {
      return res.status(400).json({ success: false, message: 'Invalid cart data' });
    }

  const uniqueItems = [...new Set(cartItems)];
    console.log('Processing cart update:', uniqueItems);

    // Clear existing items
    citemdetails = [];
    item_in_cart = 0;

    // Fetch details for each item
    let processedItems = 0;
    uniqueItems.forEach((item) => {
    connection.query(
      "SELECT * FROM menu WHERE item_id = ?",
      [item],
      function (error, results_item) {
          if (error) {
            console.error('Error fetching item:', error);
          } else if (results_item && results_item.length) {
          citemdetails.push(results_item[0]);
        }
          processedItems++;
          
          // When all items are processed, send response
          if (processedItems === uniqueItems.length) {
            item_in_cart = uniqueItems.length;
            res.status(200).json({ 
              success: true, 
              message: 'Cart updated successfully',
              items: citemdetails
            });
          }
      }
    );
  });
  } catch (error) {
    console.error('Error in updateCart:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

// Checkout
function checkout(req, res) {
  try {
    const userId = req.cookies.user_cookuid;
    const userName = req.cookies.user_cookuname;
    const paymentMode = req.body.payment_mode || 'COD'; // Default to COD if not specified
    
    if (!userId || !userName) {
      return res.render("signin");
    }

    // Verify user exists
    connection.query(
      "SELECT user_id, user_name FROM users WHERE user_id = ? AND user_name = ?",
      [userId, userName],
      function (error, results) {
        if (error || !results.length) {
          console.error('User verification failed:', error);
          return res.render("signin");
        }

        const { itemid, quantity, subprice } = req.body;
        const currDate = new Date();

        // Handle both single and multiple items
        const items = Array.isArray(itemid) ? itemid : [itemid];
        const quantities = Array.isArray(quantity) ? quantity : [quantity];
        const prices = Array.isArray(subprice) ? subprice : [subprice];

        let successCount = 0;
        let errorCount = 0;

        // Process each item
        items.forEach((item, index) => {
          if (quantities[index] > 0) {
            const orderId = uuidv4();
            const totalPrice = prices[index] * quantities[index];

            // Insert order
            connection.query(
              "INSERT INTO orders (order_id, user_id, item_id, quantity, price, datetime) VALUES (?, ?, ?, ?, ?, ?)",
              [orderId, userId, item, quantities[index], totalPrice, currDate],
              function (error) {
                if (error) {
                  console.error('Error inserting order:', error);
                  errorCount++;
                } else {
                  // Insert payment mode
                  connection.query(
                    "INSERT INTO payment_modes (order_id, payment_mode) VALUES (?, ?)",
                    [orderId, paymentMode],
                    function (error) {
                      if (error) {
                        console.error('Error inserting payment mode:', error);
                        errorCount++;
                      } else {
                        successCount++;
                        console.log('Order and payment mode inserted successfully');
                      }
                    }
                  );
                }

                // If this is the last item, proceed with response
                if (successCount + errorCount === items.length) {
                  if (errorCount > 0) {
                    console.error(`Failed to process ${errorCount} items`);
                    return res.render("error", { 
                      error: {
                        message: `Failed to process ${errorCount} items`
                      }
                    });
                  }

                  // Clear cart
                  citemdetails = [];
                  item_in_cart = 0;

                  // Redirect to confirmation page
                  res.render("confirmation", { 
                    username: userName, 
                    userid: userId,
                    successCount: successCount,
                    errorCount: errorCount,
                    paymentMode: paymentMode
                  });
                }
              }
            );
          }
        });
      }
    );
  } catch (error) {
    console.error('Error in checkout:', error);
    res.render("error", { 
      error: {
        message: 'Error processing checkout'
      }
    });
  }
}

// Render Confirmation Page
function renderConfirmationPage(req, res) {
  const userId = req.cookies.user_cookuid;
  const userName = req.cookies.user_cookuname;
  connection.query(
    "SELECT user_id, user_name FROM users WHERE user_id = ? AND user_name = ?",
    [userId, userName],
    function (error, results) {
      if (!error && results.length) {
        res.render("confirmation", { username: userName, userid: userId });
      } else {
        res.render("signin");
      }
    }
  );
}

// Render My Orders Page
function renderMyOrdersPage(req, res) {
  try {
    const userId = req.cookies.user_cookuid;
    const userName = req.cookies.user_cookuname;

    if (!userId || !userName) {
      return res.render("signin");
    }

    // First get user details
  connection.query(
    "SELECT user_id, user_name, user_address, user_email, user_mobileno FROM users WHERE user_id = ? AND user_name = ?",
    [userId, userName],
    function (error, resultUser) {
        if (error || !resultUser.length) {
          console.error('Error fetching user details:', error);
          return res.render("signin");
        }

        // Then get all orders for this user with item details and payment mode
        connection.query(
          `SELECT o.order_id, o.quantity, o.price, o.datetime, o.status,
           m.item_name, m.item_img,
           pm.payment_mode
           FROM orders o 
           JOIN menu m ON o.item_id = m.item_id 
           LEFT JOIN payment_modes pm ON o.order_id = pm.order_id
           WHERE o.user_id = ? 
           ORDER BY o.datetime DESC`,
          [userId],
          function (error, orders) {
            if (error) {
              console.error('Error fetching orders:', error);
              return res.render("myorders", {
                userDetails: resultUser,
                items: [],
                item_count: 0,
                error: 'Error fetching orders'
              });
            }

            console.log('Fetched orders:', orders.length);
              res.render("myorders", {
                userDetails: resultUser,
              items: orders,
              item_count: 0, // Set to 0 since we're not tracking cart items in this view
              error: null
            });
          }
        );
      }
    );
  } catch (error) {
    console.error('Error in renderMyOrdersPage:', error);
    res.status(500).render("error", {
      error: {
        status: 500,
        message: 'Error loading orders page',
        stack: error.stack
      }
    });
  }
}

// Render Settings Page
function renderSettingsPage(req, res) {
  const userId = req.cookies.user_cookuid;
  const userName = req.cookies.user_cookuname;
  connection.query(
    "SELECT user_id, user_name FROM users WHERE user_id = ? AND user_name = ?",
    [userId, userName],
    function (error, results) {
      if (!error && results.length) {
        res.render("settings", {
          username: userName,
          userid: userId,
          item_count: item_in_cart,
        });
      }
    }
  );
}
// Update Address
function updateAddress(req, res) {
  const userId = req.cookies.user_cookuid;
  const userName = req.cookies.user_cookuname;
  const address = req.body.address;
  connection.query(
    "SELECT user_id, user_name FROM users WHERE user_id = ? AND user_name = ?",
    [userId, userName],
    function (error, results) {
      if (!error && results.length) {
        connection.query(
          "UPDATE users SET user_address = ? WHERE user_id = ?",
          [address, userId],
          function (error, results) {
            if (!error) {
              res.render("settings", {
                username: userName,
                userid: userId,
                item_count: item_in_cart,
              });
            }
          }
        );
      } else {
        res.render("signin");
      }
    }
  );
}

// Update Contact
function updateContact(req, res) {
  const userId = req.cookies.user_cookuid;
  const userName = req.cookies.user_cookuname;
  const mobileno = req.body.mobileno;
  connection.query(
    "SELECT user_id, user_name FROM users WHERE user_id = ? AND user_name = ?",
    [userId, userName],
    function (error, results) {
      if (!error && results.length) {
        connection.query(
          "UPDATE users SET user_mobileno = ? WHERE user_id = ?",
          [mobileno, userId],
          function (error, results) {
            if (!error) {
              res.render("settings", {
                username: userName,
                userid: userId,
                item_count: item_in_cart,
              });
            }
          }
        );
      } else {
        res.render("signin");
      }
    }
  );
}

// Update Password
function updatePassword(req, res) {
  const userId = req.cookies.user_cookuid;
  const userName = req.cookies.user_cookuname;
  const oldPassword = req.body.old_password;
  const newPassword = req.body.new_password;
  connection.query(
    "SELECT user_id, user_name FROM users WHERE user_id = ? AND user_name = ? AND user_password = ?",
    [userId, userName, oldPassword],
    function (error, results) {
      if (!error && results.length) {
        connection.query(
          "UPDATE users SET user_password = ? WHERE user_id = ?",
          [newPassword, userId],
          function (error, results) {
            if (!error) {
              res.render("settings", {
                username: userName,
                userid: userId,
                item_count: item_in_cart,
              });
            }
          }
        );
      } else {
        res.render("signin");
      }
    }
  );
}

// Admin Homepage

function renderAdminHomepage(req, res) {
  const userId = req.cookies.admin_cookuid;
  const userName = req.cookies.admin_cookuname;
  connection.query(
    "SELECT admin_id, admin_name FROM admin WHERE admin_email = ? and admin_name = ?",
    [userId, userName],
    function (error, results) {
      if (!error && results.length) {
        res.render("adminHomepage", {
          username: userName,
          userid: userId,
          items: results,
        });
      } else {
        res.render("admin_signin");
      }
    }
  );
}

// Admin Sign-in

function renderAdminSignInPage(req, res) {
  res.render("admin_signin");
}

function adminSignIn(req, res) {
  const email = req.body.email;
  const password = req.body.password;
  connection.query(
    "SELECT admin_id, admin_name FROM admin WHERE admin_email = ? AND admin_password = ?",
    [email, password],
    function (error, results) {
      if (error || !results.length) {
        res.render("admin_signin");
      } else {
        const { admin_id, admin_name } = results[0];
        res.cookie("admin_cookuid", admin_id, { 
          maxAge: 24 * 60 * 60 * 1000, // 24 hours
          httpOnly: true,
          secure: false // Set to true in production with HTTPS
        });
        res.cookie("admin_cookuname", admin_name, { 
          maxAge: 24 * 60 * 60 * 1000, // 24 hours
          httpOnly: true,
          secure: false // Set to true in production with HTTPS
        });
        res.render("adminHomepage");
      }
    }
  );
}

// Render Add Food Page
function renderAddFoodPage(req, res) {
  const userId = req.cookies.admin_cookuid;
  const userName = req.cookies.admin_cookuname;
  connection.query(
    "SELECT admin_id, admin_name FROM admin WHERE admin_id = ? and admin_name = ?",
    [userId, userName],
    function (error, results) {
      if (!error && results.length) {
        res.render("admin_addFood", {
          username: userName,
          userid: userId
        });
      } else {
        res.render("admin_signin");
      }
    }
  );
}

// Add Food
function addFood(req, res) {
  const {
    FoodName,
    FoodType,
    FoodCategory,
    FoodServing,
    FoodCalories,
    FoodPrice,
    FoodRating,
  } = req.body;
  const userName = req.cookies.admin_cookuname;
  const userId = req.cookies.admin_cookuid;

  console.log('Received food item data:', {
    FoodName,
    FoodType,
    FoodCategory,
    FoodServing,
    FoodCalories,
    FoodPrice,
    FoodRating
  });

  if (!req.files) {
    console.log('No file was uploaded');
    return res.status(400).send("Image was not uploaded");
  }

  const fimage = req.files.FoodImg;
  const fimage_name = fimage.name;
  console.log('Image file details:', {
    name: fimage_name,
    mimetype: fimage.mimetype
  });

  if (fimage.mimetype == "image/jpeg" || fimage.mimetype == "image/png") {
    fimage.mv("public/images/dish/" + fimage_name, function (err) {
      if (err) {
        console.error('Error moving file:', err);
        return res.status(500).send(err);
      }
      console.log('File moved successfully to public/images/dish/');

      const query = "INSERT INTO menu (item_name, item_type, item_category, item_serving, item_calories, item_price, item_rating, item_img) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
      const values = [
          FoodName,
          FoodType,
          FoodCategory,
          FoodServing,
          FoodCalories,
          FoodPrice,
          FoodRating,
          fimage_name,
      ];

      console.log('Executing query:', query);
      console.log('With values:', values);

      connection.query(query, values, function (error, results) {
          if (error) {
          console.error('Database error:', error);
          res.render("admin_addFood", { username: userName, userid: userId });
          } else {
          console.log('Successfully inserted food item:', results);
          res.render("admin_addFood", { username: userName, userid: userId });
          }
      });
    });
  } else {
    console.log('Invalid file type:', fimage.mimetype);
    res.render("admin_addFood", { username: userName, userid: userId });
  }
}

// Render Admin View and Dispatch Orders Page
function renderViewDispatchOrdersPage(req, res) {
  try {
    const userId = req.cookies.admin_cookuid;
    const userName = req.cookies.admin_cookuname;

    if (!userId || !userName) {
      return res.redirect('/admin_signin');
    }

    // Verify admin
    connection.query(
      "SELECT admin_id, admin_name FROM admin WHERE admin_id = ? AND admin_name = ?",
      [userId, userName],
      function (error, results) {
        if (error || !results.length) {
          console.error('Admin verification failed:', error);
          return res.redirect('/admin_signin');
        }

        // Fetch all orders with item, user, and payment details
        connection.query(
          `SELECT o.*, m.item_name, m.item_img, u.user_name, u.user_email, u.user_mobileno,
           pm.payment_mode, pm.payment_status,
           COALESCE(o.status, 'ordered') as status
           FROM orders o 
           JOIN menu m ON o.item_id = m.item_id 
           JOIN users u ON o.user_id = u.user_id 
           LEFT JOIN payment_modes pm ON o.order_id = pm.order_id
           ORDER BY o.datetime DESC`,
          function (error, orders) {
            if (error) {
              console.error('Error fetching orders:', error);
              return res.render("admin_view_dispatch_orders", {
                username: userName,
                userid: userId,
                orders: [],
                error: 'Error fetching orders'
              });
            }

            console.log('Fetched orders:', orders.length);
            res.render("admin_view_dispatch_orders", {
              username: userName,
              userid: userId,
              orders: orders,
              error: null
            });
          }
        );
      }
    );
  } catch (error) {
    console.error('Error in renderViewDispatchOrdersPage:', error);
    res.status(500).render("error", {
      error: {
        status: 500,
        message: 'Error loading admin orders page',
        stack: error.stack
      }
    });
  }
}

// Dispatch Orders
function dispatchOrders(req, res) {
  const orderIds = req.body.order_id_s;
  
  if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
    return res.status(400).json({ success: false, message: 'No orders selected for dispatch' });
  }

  const uniqueOrderIds = [...new Set(orderIds)];
  let successCount = 0;
  let errorCount = 0;

  uniqueOrderIds.forEach((orderId) => {
    connection.query(
      "SELECT * FROM orders WHERE order_id = ?",
      [orderId],
      function (error, resultsItem) {
        if (error) {
          console.error('Error fetching order:', error);
          errorCount++;
          return;
        }

        if (!resultsItem.length) {
          console.error('Order not found:', orderId);
          errorCount++;
          return;
        }

        const order = resultsItem[0];
          const currDate = new Date();

          connection.query(
            "INSERT INTO order_dispatch (order_id, user_id, item_id, quantity, price, datetime) VALUES (?, ?, ?, ?, ?, ?)",
            [
            order.order_id,
            order.user_id,
            order.item_id,
            order.quantity,
            order.price,
              currDate,
            ],
            function (error, results) {
            if (error) {
              console.error('Error inserting into order_dispatch:', error);
              errorCount++;
              return;
            }

                connection.query(
                  "DELETE FROM orders WHERE order_id = ?",
              [order.order_id],
                  function (error, results2) {
                    if (error) {
                  console.error('Error deleting from orders:', error);
                  errorCount++;
                } else {
                  successCount++;
                    }
                  }
                );
            }
          );
      }
    );
  });

  // Wait a moment for all queries to complete
  setTimeout(() => {
    if (errorCount > 0) {
      res.status(500).json({ 
        success: false, 
        message: `Dispatched ${successCount} orders, failed to dispatch ${errorCount} orders` 
      });
    } else {
      res.json({ 
        success: true, 
        message: `Successfully dispatched ${successCount} orders` 
      });
    }
  }, 1000);
}

// Render Admin Change Price Page
function renderChangePricePage(req, res) {
  const userId = req.cookies.admin_cookuid;
  const userName = req.cookies.admin_cookuname;

  if (!userId || !userName) {
    console.log('No user credentials found, redirecting to signin');
    return res.redirect('/signin');
  }

  connection.query(
    "SELECT admin_id, admin_name FROM admin WHERE admin_id = ? and admin_name = ?",
    [userId, userName],
    function (error, results) {
      if (error) {
        console.error('Error checking admin credentials:', error);
        return res.status(500).render('error', { 
          error: {
            status: 500,
            message: 'Internal server error',
            stack: error.stack
          }
        });
      }

      if (!results.length) {
        console.log('Admin not found, redirecting to signin');
        return res.redirect('/signin');
      }

      connection.query("SELECT item_id, item_name, item_price FROM menu", function (error, menuResults) {
        if (error) {
          console.error('Error fetching menu items:', error);
          return res.status(500).render('error', { 
            error: {
              status: 500,
              message: 'Error fetching menu items',
              stack: error.stack
            }
          });
        }

        console.log('Successfully fetched menu items:', menuResults.length);
            res.render("admin_change_price", {
              username: userName,
          items: menuResults,
            });
        });
    }
  );
}

// Change Price
function changePrice(req, res) {
  const { foodId, newPrice } = req.body;
  
  if (!foodId || !newPrice) {
    return res.status(400).json({ success: false, message: 'Food ID and new price are required' });
  }

  connection.query(
    "UPDATE menu SET item_price = ? WHERE item_id = ?",
    [newPrice, foodId],
    function (error, results) {
      if (error) {
        console.error('Error updating price:', error);
        return res.status(500).json({ success: false, message: 'Error updating price' });
      }
      
      if (results.affectedRows === 0) {
        return res.status(404).json({ success: false, message: 'Food item not found' });
      }
      
      res.json({ success: true, message: 'Price updated successfully' });
    }
  );
}

// Logout
function logout(req, res) {
  // Check if it's an admin logout
  if (req.cookies.admin_cookuid) {
    res.clearCookie('admin_cookuid');
    res.clearCookie('admin_cookuname');
    return res.redirect("/admin_signin");
  }
  // Otherwise it's a user logout
  res.clearCookie('user_cookuid');
  res.clearCookie('user_cookuname');
  return res.redirect("/signin");
}

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('New client connected');
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Add this endpoint to handle order status updates
app.post("/update_order_status", (req, res) => {
  console.log('Received update_order_status request:', req.body);
  try {
    const adminId = req.cookies.admin_cookuid;
    const adminName = req.cookies.admin_cookuname;
    const { orderId, status } = req.body;

    if (!adminId || !adminName) {
      console.log('Unauthorized: Missing admin credentials');
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Verify admin
    connection.query(
      "SELECT admin_id, admin_name FROM admin WHERE admin_id = ? AND admin_name = ?",
      [adminId, adminName],
      function (error, results) {
        if (error || !results.length) {
          console.error('Admin verification failed:', error);
          return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        // Update order status
        connection.query(
          "UPDATE orders SET status = ? WHERE order_id = ?",
          [status, orderId],
          function (error, results) {
            if (error) {
              console.error('Error updating order status:', error);
              return res.status(500).json({ success: false, message: 'Error updating order status' });
            }

            if (results.affectedRows === 0) {
              console.log('Order not found:', orderId);
              return res.status(404).json({ success: false, message: 'Order not found' });
            }

            console.log('Order status updated successfully:', { orderId, status });
            res.json({ success: true, message: 'Order status updated successfully' });
          }
        );
      }
    );
  } catch (error) {
    console.error('Error in update_order_status:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Add endpoint to check for notifications
app.get("/check_notifications", (req, res) => {
  const userId = req.cookies.user_cookuid;
  const userName = req.cookies.user_cookuname;

  if (!userId || !userName) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  // First, get all unread notifications
  connection.query(
    `SELECT n.notification_id, n.order_id, n.old_status, n.new_status, n.notification_time
     FROM order_notifications n
     WHERE n.user_id = ? AND n.is_read = FALSE
     ORDER BY n.notification_time DESC`,
    [userId],
    function(error, notifications) {
      if (error) {
        console.error('Error fetching notifications:', error);
        return res.status(500).json({ success: false, message: 'Error checking notifications' });
      }

      // Mark notifications as read
      if (notifications.length > 0) {
        const notificationIds = notifications.map(n => n.notification_id);
        connection.query(
          'UPDATE order_notifications SET is_read = TRUE WHERE notification_id IN (?)',
          [notificationIds],
          function(error) {
            if (error) {
              console.error('Error marking notifications as read:', error);
            }
          }
        );
      }

      // Format notifications for response
      const formattedNotifications = notifications.map(notification => ({
        notification_id: notification.notification_id,
        message: `Your order #${notification.order_id} status changed from ${notification.old_status} to ${notification.new_status}`,
        time: notification.notification_time
      }));

      res.json({ success: true, notifications: formattedNotifications });
    }
  );
});

// Start the server
const PORT = process.env.PORT || 3002;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log('Registered routes:');
  app._router.stack.forEach((r) => {
    if (r.route && r.route.path) {
      console.log(`${Object.keys(r.route.methods)[0].toUpperCase()} ${r.route.path}`);
    }
  });
});

module.exports = app;
