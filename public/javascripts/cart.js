let item_count = 0;
let cart = [];

function addToCart(item_id) {
  item_count++;
  document.getElementById("cart-number-count").innerHTML = item_count;
  const name = "btn" + item_id;
  document.getElementById(name).disabled = true;
  document.getElementById(name).innerHTML = "Added";
  cart.push(item_id);
  console.log('Item added to cart:', item_id);
  console.log('Current cart:', cart);
}

function openMyCart() {
  console.log('Opening cart with items:', cart);
  const url = "/cart";
  
  if (cart.length === 0) {
    alert('Your cart is empty. Please add some items first.');
    return;
  }

  fetch(url, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json" 
    },
    body: JSON.stringify({
      cart: cart,
      item_count: item_count,
    }),
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  })
  .then(data => {
    console.log('Cart update response:', data);
    if (data.success) {
      window.location.href = url;
    } else {
      throw new Error(data.message || 'Failed to update cart');
    }
  })
  .catch(error => {
    console.error('Error:', error);
    alert('Error opening cart. Please try again.');
  });
}
