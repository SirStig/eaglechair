import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardMedia,
  CardActions,
  Chip,
  CircularProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import axios from 'axios';

function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch products from API
    // For now, using mock data
    setTimeout(() => {
      setProducts([
        {
          id: 1,
          name: 'Executive Chair',
          description: 'Premium leather executive chair with lumbar support',
          price: 499.99,
          image: 'https://via.placeholder.com/300x200?text=Executive+Chair',
          inStock: true,
        },
        {
          id: 2,
          name: 'Ergonomic Office Chair',
          description: 'Comfortable ergonomic chair for long work sessions',
          price: 299.99,
          image: 'https://via.placeholder.com/300x200?text=Ergonomic+Chair',
          inStock: true,
        },
        {
          id: 3,
          name: 'Gaming Chair',
          description: 'High-performance gaming chair with adjustable features',
          price: 399.99,
          image: 'https://via.placeholder.com/300x200?text=Gaming+Chair',
          inStock: false,
        },
      ]);
      setLoading(false);
    }, 1000);
  }, []);

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="400px"
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={3}
      >
        <Typography variant="h4">Products</Typography>
        <Button variant="contained" startIcon={<AddIcon />}>
          Add Product
        </Button>
      </Box>

      <Grid container spacing={3}>
        {products.map((product) => (
          <Grid item xs={12} sm={6} md={4} key={product.id}>
            <Card>
              <CardMedia
                component="img"
                height="200"
                image={product.image}
                alt={product.name}
              />
              <CardContent>
                <Box
                  display="flex"
                  justifyContent="space-between"
                  alignItems="start"
                  mb={1}
                >
                  <Typography variant="h6" component="div">
                    {product.name}
                  </Typography>
                  <Chip
                    label={product.inStock ? 'In Stock' : 'Out of Stock'}
                    color={product.inStock ? 'success' : 'error'}
                    size="small"
                  />
                </Box>
                <Typography variant="body2" color="text.secondary" mb={2}>
                  {product.description}
                </Typography>
                <Typography variant="h6" color="primary">
                  ${product.price.toFixed(2)}
                </Typography>
              </CardContent>
              <CardActions>
                <Button size="small">Edit</Button>
                <Button size="small" color="error">
                  Delete
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

export default Products;

