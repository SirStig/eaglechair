import { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

function Quotes() {
  const [quotes] = useState([
    {
      id: 'Q-001',
      customer: 'Acme Corporation',
      date: '2025-10-01',
      total: 4999.99,
      status: 'pending',
    },
    {
      id: 'Q-002',
      customer: 'Tech Solutions Inc',
      date: '2025-09-28',
      total: 2499.99,
      status: 'approved',
    },
    {
      id: 'Q-003',
      customer: 'Global Enterprises',
      date: '2025-09-25',
      total: 7999.99,
      status: 'rejected',
    },
  ]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved':
        return 'success';
      case 'pending':
        return 'warning';
      case 'rejected':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={3}
      >
        <Typography variant="h4">Quotes</Typography>
        <Button variant="contained" startIcon={<AddIcon />}>
          Create Quote
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Quote ID</TableCell>
              <TableCell>Customer</TableCell>
              <TableCell>Date</TableCell>
              <TableCell align="right">Total</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {quotes.map((quote) => (
              <TableRow
                key={quote.id}
                sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
              >
                <TableCell component="th" scope="row">
                  {quote.id}
                </TableCell>
                <TableCell>{quote.customer}</TableCell>
                <TableCell>{quote.date}</TableCell>
                <TableCell align="right">
                  ${quote.total.toFixed(2)}
                </TableCell>
                <TableCell>
                  <Chip
                    label={quote.status}
                    color={getStatusColor(quote.status)}
                    size="small"
                    sx={{ textTransform: 'capitalize' }}
                  />
                </TableCell>
                <TableCell align="center">
                  <IconButton size="small" color="primary">
                    <VisibilityIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" color="primary">
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" color="error">
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

export default Quotes;

