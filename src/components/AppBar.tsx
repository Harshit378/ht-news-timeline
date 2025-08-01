import React from "react";
import { Link } from "react-router-dom";
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';
import SearchIcon from '@mui/icons-material/Search';
import InputAdornment from '@mui/material/InputAdornment';

const AppBarComponent: React.FC = () => {
  return (
    <AppBar position="static" color="default" elevation={1}>
      <Toolbar>
        {/* Logo */}
        <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
          <Box display="flex" alignItems="center" gap={1}>
            <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>
              <Typography variant="h6" fontSize={16} fontWeight="bold">N</Typography>
            </Avatar>
            <Typography variant="h6" fontWeight={600} color="primary">NewsTracker</Typography>
          </Box>
        </Link>
        
        {/* Search Bar */}
        <Box flex={1} display="flex" justifyContent="center" mx={4}>
          <TextField
            placeholder="Search news..."
            variant="outlined"
            size="small"
            sx={{ 
              width: '100%', 
              maxWidth: 400,
              '& .MuiOutlinedInput-root': {
                borderRadius: 3,
                backgroundColor: 'background.paper',
              }
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
            }}
          />
        </Box>
        
        {/* Sign In Button */}
        <Button 
          variant="contained" 
          color="primary"
          sx={{ 
            borderRadius: 3, 
            textTransform: 'none',
            fontWeight: 500,
            px: 3
          }}
        >
          Sign In
        </Button>
      </Toolbar>
    </AppBar>
  );
};

export default AppBarComponent;