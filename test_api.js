const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

async function test() {
  try {
    const catRes = await axios.get('http://localhost:5000/api/v1/categories');
    const categories = catRes.data.data.categories;
    const categoryId = categories[0].id;

    const form = new FormData();
    form.append('name', `Test Upload ${Date.now()}`);
    form.append('categoryId', categoryId);
    form.append('unitPrice', 1000);
    form.append('boxPrice', 10000);
    form.append('quantityInBox', 10);
    form.append('costPrice', 800);
    form.append('boxCostPrice', 8000);
    form.append('stock', 0);
    form.append('boxes', 0);
    form.append('paymentType', 'CASH');

    // Create a dummy image
    fs.writeFileSync('test_image.jpg', 'fake image content');
    form.append('image', fs.createReadStream('test_image.jpg'));

    const response = await axios.post('http://localhost:5000/api/v1/products', form, {
      headers: form.getHeaders()
    });
    console.log(response.data);
  } catch (error) {
    console.error(error.response ? error.response.data : error.message);
  }
}
test();
