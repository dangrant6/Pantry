"use client";
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Box, Stack, Typography, Button, Modal, TextField, Select, MenuItem,
  FormControl, InputLabel, IconButton, Paper, AppBar, Toolbar, Container,
  Fab, Chip, Divider, CircularProgress, Snackbar, Alert, Switch
} from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { firestore, auth } from '@/firebase';
import { signInAnonymously, onAuthStateChanged } from "firebase/auth";
import {
  collection, doc, getDocs, query, setDoc, deleteDoc, getDoc,
  limit, startAfter, orderBy,
} from 'firebase/firestore';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import Papa from 'papaparse';

// function to get design tokens based on the mode (light or dark)
const getDesignTokens = (mode) => ({
  palette: {
    mode,
    ...(mode === 'light'
      ? {
          // light mode palette
          primary: {
            main: '#4a148c',
          },
          secondary: {
            main: '#ff6e40',
          },
          background: {
            default: '#f5f5f5',
            paper: '#ffffff',
          },
        }
      : {
          // dark mode palette
          primary: {
            main: '#7c4dff',
          },
          secondary: {
            main: '#ff9e80',
          },
          background: {
            default: '#303030',
            paper: '#424242',
          },
        }),
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 700,
    },
    h5: {
      fontWeight: 600,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 20,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 16,
        },
      },
    },
  },
});

// style for the modal component
const modalStyle = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '90%',
  maxWidth: 400,
  bgcolor: 'background.paper',
  boxShadow: 24,
  p: 4,
  borderRadius: 2,
};

// function to fetch inventory from firestore
const fetchInventory = async (userId, searchQuery = '', pageSize = 10, lastVisible = null) => {
  try {
    let inventoryQuery = query(
      collection(firestore, `users/${userId}/inventory`),
      orderBy('name'),
      limit(pageSize)
    );

    if (searchQuery) {
      inventoryQuery = query(
        collection(firestore, `users/${userId}/inventory`),
        orderBy('name'),
        limit(pageSize)
      );
    }

    if (lastVisible) {
      inventoryQuery = query(inventoryQuery, startAfter(lastVisible));
    }

    const snapshot = await getDocs(inventoryQuery);
    const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const lastDoc = snapshot.docs[snapshot.docs.length - 1];
    return { items, lastDoc };
  } catch (error) {
    console.error('Error fetching inventory:', error);
    throw error;
  }
};

// function to add an item to firestore
const addItemToFirestore = async (userId, item, category, quantity) => {
  try {
    const docRef = doc(collection(firestore, `users/${userId}/inventory`), item);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      await setDoc(docRef, { name: item, quantity: quantity, category }, { merge: true });
    } else {
      await setDoc(docRef, { name: item, quantity: quantity, category });
    }
    console.log(`Item ${item} added/updated successfully.`);
  } catch (error) {
    console.error('Error adding item to Firestore:', error);
    throw error;
  }
};

// function to remove an item from firestore
const removeItemFromFirestore = async (userId, itemId) => {
  try {
    const docRef = doc(firestore, `users/${userId}/inventory`, itemId);
    await deleteDoc(docRef);
    console.log(`Item ${itemId} removed successfully.`);
  } catch (error) {
    console.error('Error removing item from Firestore:', error);
    throw error;
  }
};

// function to export inventory to CSV
const exportToCSV = (inventory) => {
  const csv = Papa.unparse(inventory);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'inventory.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// main component for the home page
export default function Home() {
  const [inventory, setInventory] = useState([]);
  const [open, setOpen] = useState(false);
  const [openDetails, setOpenDetails] = useState(false);
  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);
  const [lastVisible, setLastVisible] = useState(null);
  const [currentItem, setCurrentItem] = useState(null);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [mode, setMode] = useState('light');

  // function to update inventory
  const updateInventory = useCallback(async (userId, searchQuery = '', pageSize = 10, lastVisible = null) => {
    try {
      if (navigator.onLine) {
        const { items, lastDoc } = await fetchInventory(userId, searchQuery, pageSize, lastVisible);
        setInventory(prevItems => [...prevItems, ...items]);
        setLastVisible(lastDoc);
      } else {
        setError('Client is offline. Please check your internet connection.');
      }
    } catch (err) {
      setError('Failed to fetch inventory. Please try again later.');
      console.error(err);
    }
  }, []);

  // useEffect hook to handle user authentication state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        updateInventory(currentUser.uid);
      } else {
        signInAnonymously(auth)
          .then(() => {
            console.log("Signed in anonymously");
          })
          .catch((error) => {
            console.error("Error signing in anonymously:", error);
            setError("Failed to sign in anonymously. Please try again later.");
          });
      }
    });
    return () => unsubscribe();
  }, [updateInventory]);

  // handle adding an item to the inventory
  const handleAddItem = async () => {
    try {
      if (navigator.onLine && user) {
        await addItemToFirestore(user.uid, itemName, category, quantity);
        setItemName('');
        setCategory('');
        setQuantity(1);
        setOpen(false);
        setInventory([]);
        updateInventory(user.uid);
      } else {
        setError('Client is offline. Please check your internet connection.');
      }
    } catch (err) {
      setError('Failed to add item. Please try again later.');
      console.error(err);
    }
  };

  // handle removing an item from the inventory
  const handleRemoveItem = async (itemId) => {
    try {
      if (navigator.onLine && user) {
        await removeItemFromFirestore(user.uid, itemId);
        setInventory(inventory.filter(item => item.id !== itemId));
      } else {
        setError('Client is offline. Please check your internet connection.');
      }
    } catch (err) {
      setError('Failed to remove item. Please try again later.');
      console.error(err);
    }
  };

  // handle searching for items
  const handleSearch = () => {
    setInventory([]);
    updateInventory(user.uid, searchQuery);
  };

  // open item details modal
  const handleOpenDetails = (item) => {
    setCurrentItem(item);
    setOpenDetails(true);
  };

  // load more items
  const handleLoadMore = () => {
    updateInventory(user.uid, searchQuery, 10, lastVisible);
  };

  // handle editing an item in the inventory
  const handleEditItem = async () => {
    try {
      if (navigator.onLine && user) {
        await addItemToFirestore(user.uid, currentItem.name, currentItem.category, currentItem.quantity);
        setOpenDetails(false);
        setInventory([]);
        updateInventory(user.uid);
      } else {
        setError('Client is offline. Please check your internet connection.');
      }
    } catch (err) {
      setError('Failed to update item. Please try again later.');
      console.error(err);
    }
  };

  // show a snackbar notification
  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  // close snackbar notification
  const handleCloseSnackbar = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbar({ ...snackbar, open: false });
  };

  // toggle between light and dark mode
  const toggleColorMode = () => {
    setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
  };

  // memoize theme object to avoid unnecessary re-renders
  const theme = useMemo(() => createTheme(getDesignTokens(mode)), [mode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ flexGrow: 1, height: '100vh', bgcolor: 'background.default' }}>
        <AppBar position="static" color="primary" elevation={0}>
          <Toolbar>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              Your Personal Pantry
            </Typography>
            <IconButton sx={{ ml: 1 }} onClick={toggleColorMode} color="inherit">
              {theme.palette.mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
            </IconButton>
          </Toolbar>
        </AppBar>
        <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          {!user ? (
            <Box display="flex" justifyContent="center" alignItems="center" height="50vh">
              <CircularProgress />
            </Box>
          ) : (
            <>
              <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
                <Box display="flex" gap={2} mb={2}>
                  <TextField
                    label="Search"
                    variant="outlined"
                    fullWidth
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    InputProps={{
                      endAdornment: (
                        <IconButton onClick={handleSearch}>
                          <SearchIcon />
                        </IconButton>
                      ),
                    }}
                  />
                </Box>
                <Box sx={{ maxHeight: '60vh', overflow: 'auto', mt: 2 }}>
                  <Stack spacing={2}>
                    {inventory.map(({ id, name = '', quantity = 0, category = '' }) => (
                      <Paper key={id} elevation={2} sx={{ p: 2 }}>
                        <Box display="flex" justifyContent="space-between" alignItems="center">
                          <Box>
                            <Typography variant="h6" color="primary">
                              {name.charAt(0).toUpperCase() + name.slice(1)}
                            </Typography>
                            <Chip label={category} color="secondary" size="small" sx={{ mt: 1 }} />
                          </Box>
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="subtitle1" color="text.secondary">
                              Quantity: {quantity}
                            </Typography>
                            <IconButton color="primary" onClick={() => handleOpenDetails({ id, name, category, quantity })}>
                              <EditIcon />
                            </IconButton>
                            <IconButton color="error" onClick={() => handleRemoveItem(id)}>
                              <DeleteIcon />
                            </IconButton>
                          </Box>
                        </Box>
                      </Paper>
                    ))}
                  </Stack>
                </Box>
                {lastVisible && (
                  <Box display="flex" justifyContent="center" mt={2}>
                    <Button variant="outlined" onClick={handleLoadMore} startIcon={loading ? <CircularProgress size={20} /> : null}>
                      {loading ? 'Loading...' : 'Load More'}
                    </Button>
                  </Box>
                )}
              </Paper>
              <Box display="flex" justifyContent="space-between">
                <Button
                  variant="contained"
                  color="secondary"
                  onClick={() => exportToCSV(inventory)}
                  startIcon={<DownloadIcon />}
                >
                  Export to CSV
                </Button>
              </Box>
            </>
          )}
        </Container>
        <Fab
          color="primary"
          aria-label="add"
          onClick={() => setOpen(true)}
          sx={{ position: 'fixed', bottom: 16, right: 16 }}
        >
          <AddIcon />
        </Fab>
        <Modal
          open={open}
          onClose={() => setOpen(false)}
          aria-labelledby="modal-modal-title"
          aria-describedby="modal-modal-description"
        >
          <Box sx={modalStyle}>
            <Typography id="modal-modal-title" variant="h6" component="h2" gutterBottom>
              Add Item
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Stack spacing={3}>
              <TextField
                label="Item"
                variant="outlined"
                fullWidth
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
              />
              <FormControl fullWidth>
                <InputLabel id="category-label">Category</InputLabel>
                <Select
                  labelId="category-label"
                  value={category}
                  label="Category"
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <MenuItem value={"Fruit"}>Fruit</MenuItem>
                  <MenuItem value={"Vegetable"}>Vegetable</MenuItem>
                  <MenuItem value={"Dairy"}>Dairy</MenuItem>
                  <MenuItem value={"Meat"}>Meat</MenuItem>
                  <MenuItem value={"Grain"}>Grain</MenuItem>
                  <MenuItem value={"Other"}>Other</MenuItem>
                </Select>
              </FormControl>
              <TextField
                label="Quantity"
                variant="outlined"
                fullWidth
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
              />
              <Button
                variant="contained"
                onClick={handleAddItem}
                fullWidth
                disabled={!itemName || !category}
              >
                Add
              </Button>
            </Stack>
          </Box>
        </Modal>
        <Modal
          open={openDetails}
          onClose={() => setOpenDetails(false)}
          aria-labelledby="modal-modal-title"
          aria-describedby="modal-modal-description"
        >
          <Box sx={modalStyle}>
            <Typography id="modal-modal-title" variant="h6" component="h2" gutterBottom>
              Edit Item
            </Typography>
            <Divider sx={{ mb: 2 }} />
            {currentItem && (
              <Stack spacing={3}>
                <TextField
                  label="Item"
                  variant="outlined"
                  fullWidth
                  value={currentItem.name}
                  onChange={(e) => setCurrentItem({ ...currentItem, name: e.target.value })}
                />
                <FormControl fullWidth>
                  <InputLabel id="category-label">Category</InputLabel>
                  <Select
                    labelId="category-label"
                    value={currentItem.category}
                    label="Category"
                    onChange={(e) => setCurrentItem({ ...currentItem, category: e.target.value })}
                  >
                    <MenuItem value={"Fruit"}>Fruit</MenuItem>
                    <MenuItem value={"Vegetable"}>Vegetable</MenuItem>
                    <MenuItem value={"Dairy"}>Dairy</MenuItem>
                    <MenuItem value={"Meat"}>Meat</MenuItem>
                    <MenuItem value={"Grain"}>Grain</MenuItem>
                    <MenuItem value={"Other"}>Other</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  label="Quantity"
                  variant="outlined"
                  fullWidth
                  type="number"
                  value={currentItem.quantity}
                  onChange={(e) => setCurrentItem({ ...currentItem, quantity: Number(e.target.value) })}
                />
                <Button
                  variant="contained"
                  onClick={handleEditItem}
                  fullWidth
                >
                  Save
                </Button>
              </Stack>
            )}
          </Box>
        </Modal>
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </ThemeProvider>
  );
}
