import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Divider,
} from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import BusinessIcon from '@mui/icons-material/Business';

function About() {
  const companyInfo = {
    name: 'EagleChair Manufacturing Co.',
    description:
      'Leading manufacturer of premium office and executive chairs since 1995. We specialize in ergonomic design and sustainable manufacturing practices.',
    email: 'info@eaglechair.com',
    phone: '+1 (555) 123-4567',
    address: '123 Business Park, Suite 500, New York, NY 10001',
  };

  const stats = [
    { label: 'Years in Business', value: '28+' },
    { label: 'Products Sold', value: '500K+' },
    { label: 'Happy Customers', value: '10K+' },
    { label: 'Countries Served', value: '45+' },
  ];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        About Us
      </Typography>

      <Paper sx={{ p: 4, mb: 4 }}>
        <Box display="flex" alignItems="center" mb={2}>
          <BusinessIcon sx={{ fontSize: 48, mr: 2, color: 'primary.main' }} />
          <Typography variant="h5">{companyInfo.name}</Typography>
        </Box>
        <Typography variant="body1" paragraph>
          {companyInfo.description}
        </Typography>

        <Divider sx={{ my: 3 }} />

        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Box display="flex" alignItems="center">
              <EmailIcon sx={{ mr: 2, color: 'primary.main' }} />
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Email
                </Typography>
                <Typography variant="body1">{companyInfo.email}</Typography>
              </Box>
            </Box>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box display="flex" alignItems="center">
              <PhoneIcon sx={{ mr: 2, color: 'primary.main' }} />
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Phone
                </Typography>
                <Typography variant="body1">{companyInfo.phone}</Typography>
              </Box>
            </Box>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box display="flex" alignItems="center">
              <LocationOnIcon sx={{ mr: 2, color: 'primary.main' }} />
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Address
                </Typography>
                <Typography variant="body1">{companyInfo.address}</Typography>
              </Box>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      <Typography variant="h5" gutterBottom>
        Our Impact
      </Typography>
      <Grid container spacing={3}>
        {stats.map((stat, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h3" color="primary" gutterBottom>
                  {stat.value}
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  {stat.label}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

export default About;

