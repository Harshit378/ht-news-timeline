import React from "react";
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import CardMedia from '@mui/material/CardMedia';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Avatar from '@mui/material/Avatar';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';

const topics = [
  "Trump tariffs",
  "Russia earthquake",
  "MH370",
  "Air India 171 Crash"
];

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const PAST_DEV_MAX_HEIGHT = 90;

const YourSpace: React.FC = () => {
  return (
    <Box maxWidth="lg" mx="auto" py={4} px={2}>
      <Typography variant="h4" component="h1" gutterBottom align="center" color="primary" fontWeight={600}>
        Your Space
      </Typography>
      <Typography variant="body1" color="text.secondary" align="center" mb={4}>
        Track your bookmarked news and developments
      </Typography>
      
      <Grid container spacing={3} justifyContent="flex-start" alignItems="flex-start">
        {topics.map((topic, idx) => (
          <Grid item xs={12} sm={6} md={4} key={idx}>
            <Card variant="outlined" sx={{ borderRadius: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardHeader
                avatar={<Avatar sx={{ bgcolor: 'secondary.main' }}><BookmarkIcon fontSize="small" /></Avatar>}
                title={<Typography variant="subtitle1" fontWeight={700} noWrap>{topic}</Typography>}
                action={
                  <Button
                    startIcon={<BookmarkBorderIcon />}
                    size="small"
                    sx={{ fontSize: 10, textTransform: 'none' }}
                  >
                    Track
                  </Button>
                }
                sx={{ pb: 0, pt: 2, px: 2 }}
              />
              <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 2, pt: 1 }}>
                {/* Placeholder for bookmarked news */}
                <Box display="flex" alignItems="center" justifyContent="center" minHeight={120}>
                  <Box textAlign="center">
                    <BookmarkBorderIcon sx={{ fontSize: 48, color: 'grey.300', mb: 1 }} />
                    <Typography variant="body2" color="text.secondary" fontSize={12}>
                      No bookmarked news for this topic yet
                    </Typography>
                    <Button 
                      variant="outlined" 
                      size="small" 
                      sx={{ mt: 1, fontSize: 10, textTransform: 'none' }}
                    >
                      Start Tracking
                    </Button>
                  </Box>
                </Box>
                
                {/* Past Developments Placeholder */}
                <Box mt={2}>
                  <Divider sx={{ mb: 1 }}>Past Developments</Divider>
                  <Typography variant="body2" color="text.secondary" fontSize={10} align="center">
                    Bookmarked developments will appear here
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default YourSpace;