import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Paper,
} from '@mui/material';
import ChairIcon from '@mui/icons-material/Chair';
import RequestQuoteIcon from '@mui/icons-material/RequestQuote';
import BusinessIcon from '@mui/icons-material/Business';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { useNavigate } from 'react-router-dom';

function Home() {
  const navigate = useNavigate();

  const features = [
    {
      title: 'Product Management',
      description: 'Manage your chair product catalog with ease',
      icon: <ChairIcon sx={{ fontSize: 48 }} color="primary" />,
      action: () => navigate('/products'),
    },
    {
      title: 'Quote Generation',
      description: 'Create and manage quotes for your customers',
      icon: <RequestQuoteIcon sx={{ fontSize: 48 }} color="secondary" />,
      action: () => navigate('/quotes'),
    },
    {
      title: 'Company Information',
      description: 'View and update your company details',
      icon: <BusinessIcon sx={{ fontSize: 48 }} color="success" />,
      action: () => navigate('/about'),
    },
    {
      title: 'Analytics',
      description: 'Track your business performance',
      icon: <TrendingUpIcon sx={{ fontSize: 48 }} color="warning" />,
      action: () => {},
    },
  ];

  return (
    <Box>
      <Paper
        elevation={0}
        sx={{
          p: 4,
          mb: 4,
          background: 'linear-gradient(45deg, #1976d2 30%, #42a5f5 90%)',
          color: 'white',
          borderRadius: 2,
        }}
      >
        <Typography variant="h2" gutterBottom>
          Welcome to EagleChair
        </Typography>
        <Typography variant="h5">
          Your comprehensive chair management system
        </Typography>
      </Paper>

      <Grid container spacing={3}>
        {features.map((feature, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                transition: 'transform 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                },
              }}
            >
              <CardContent sx={{ flexGrow: 1, textAlign: 'center' }}>
                <Box sx={{ mb: 2 }}>{feature.icon}</Box>
                <Typography variant="h5" gutterBottom>
                  {feature.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {feature.description}
                </Typography>
              </CardContent>
              <CardActions sx={{ justifyContent: 'center', pb: 2 }}>
                <Button
                  size="small"
                  variant="contained"
                  onClick={feature.action}
                >
                  Learn More
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Box sx={{ mt: 4 }}>
        <Typography variant="h4" gutterBottom>
          Getting Started
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                1. Add Products
              </Typography>
              <Typography variant="body2">
                Start by adding your chair products to the catalog
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                2. Create Quotes
              </Typography>
              <Typography variant="body2">
                Generate professional quotes for your customers
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                3. Track Performance
              </Typography>
              <Typography variant="body2">
                Monitor your business metrics and growth
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}

export default Home;

