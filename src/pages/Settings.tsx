import React, { useState } from "react";
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import Divider from '@mui/material/Divider';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import SettingsIcon from '@mui/icons-material/Settings';
import SourceIcon from '@mui/icons-material/Source';
import ToggleOnIcon from '@mui/icons-material/ToggleOn';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';

const newsSources = [
  "BBC News",
  "CNN",
  "Reuters",
  "Associated Press",
  "The New York Times",
  "The Washington Post",
  "USA Today",
  "NPR"
];

const newsVerticals = [
  "Weather",
  "Sports", 
  "Crime",
  "Politics",
  "Money",
  "Technology",
  "Entertainment",
  "Health"
];

const Settings: React.FC = () => {
  const [selectedSources, setSelectedSources] = useState<string[]>(["BBC News", "CNN", "Reuters"]);
  const [enabledVerticals, setEnabledVerticals] = useState<string[]>(["Weather", "Sports", "Politics", "Money"]);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const handleSourceToggle = (source: string) => {
    setSelectedSources(prev => 
      prev.includes(source) 
        ? prev.filter(s => s !== source)
        : [...prev, source]
    );
  };

  const handleVerticalToggle = (vertical: string) => {
    setEnabledVerticals(prev => 
      prev.includes(vertical) 
        ? prev.filter(v => v !== vertical)
        : [...prev, vertical]
    );
  };

  return (
    <Box maxWidth="md" mx="auto" py={4} px={2}>
      <Typography variant="h4" component="h1" gutterBottom align="center" color="primary" fontWeight={600}>
        Settings
      </Typography>
      
      <Grid container spacing={3}>
        {/* News Sources */}
        <Grid item xs={12} md={6}>
          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <CardHeader
              avatar={<SourceIcon color="primary" />}
              title={<Typography variant="h6" fontWeight={600}>News Sources</Typography>}
              titleTypographyProps={{ variant: 'h6' }}
            />
            <CardContent>
              <List dense>
                {newsSources.map((source) => (
                  <ListItem key={source} dense>
                    <ListItemIcon>
                      <Checkbox
                        edge="start"
                        checked={selectedSources.includes(source)}
                        onChange={() => handleSourceToggle(source)}
                        size="small"
                      />
                    </ListItemIcon>
                    <ListItemText 
                      primary={source}
                      primaryTypographyProps={{ variant: 'body2' }}
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* News Verticals */}
        <Grid item xs={12} md={6}>
          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <CardHeader
              avatar={<ToggleOnIcon color="primary" />}
              title={<Typography variant="h6" fontWeight={600}>News Verticals</Typography>}
              titleTypographyProps={{ variant: 'h6' }}
            />
            <CardContent>
              <List dense>
                {newsVerticals.map((vertical) => (
                  <ListItem key={vertical} dense>
                    <ListItemIcon>
                      <Switch
                        edge="start"
                        checked={enabledVerticals.includes(vertical)}
                        onChange={() => handleVerticalToggle(vertical)}
                        size="small"
                      />
                    </ListItemIcon>
                    <ListItemText 
                      primary={vertical}
                      primaryTypographyProps={{ variant: 'body2' }}
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Theme Toggle */}
        <Grid item xs={12}>
          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <CardHeader
              avatar={<SettingsIcon color="primary" />}
              title={<Typography variant="h6" fontWeight={600}>Theme</Typography>}
              titleTypographyProps={{ variant: 'h6' }}
            />
            <CardContent>
              <FormControl component="fieldset">
                <FormLabel component="legend">Select Theme</FormLabel>
                <RadioGroup
                  row
                  value={theme}
                  onChange={(e) => setTheme(e.target.value as 'light' | 'dark')}
                >
                  <FormControlLabel
                    value="light"
                    control={<Radio size="small" />}
                    label={
                      <Box display="flex" alignItems="center" gap={1}>
                        <Brightness7Icon fontSize="small" />
                        <Typography variant="body2">Light</Typography>
                      </Box>
                    }
                  />
                  <FormControlLabel
                    value="dark"
                    control={<Radio size="small" />}
                    label={
                      <Box display="flex" alignItems="center" gap={1}>
                        <Brightness4Icon fontSize="small" />
                        <Typography variant="body2">Dark</Typography>
                      </Box>
                    }
                  />
                </RadioGroup>
              </FormControl>
            </CardContent>
          </Card>
        </Grid>

        {/* Save Button */}
        <Grid item xs={12}>
          <Box display="flex" justifyContent="center" mt={2}>
            <Button 
              variant="contained" 
              color="primary" 
              size="large"
              sx={{ 
                borderRadius: 3, 
                textTransform: 'none',
                fontWeight: 500,
                px: 4
              }}
            >
              Save Settings
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Settings;