import React, { useEffect, useState, useRef } from "react";
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
import ArticleIcon from '@mui/icons-material/Article';
import IconButton from '@mui/material/IconButton';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import SourceIcon from '@mui/icons-material/Source';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';

const topics = [
  "Trump tariffs",
  "Russia earthquake",
  "MH370",
  "Air India 171 Crash"
];

const API_KEY = import.meta.env.VITE_NEWSAPI_KEY;
const BASE_URL = "https://newsapi.org/v2/everything";

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
const AUTO_PLAY_INTERVAL = 3000; // 3 seconds

const Home: React.FC = () => {
  const [newsByTopic, setNewsByTopic] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [carouselIndices, setCarouselIndices] = useState<Record<string, number>>({});
  const [autoPlayEnabled, setAutoPlayEnabled] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [visitedArticles, setVisitedArticles] = useState<Set<string>>(new Set());
  const autoPlayRefs = useRef<Record<string, NodeJS.Timeout>>({});

  useEffect(() => {
    setLoading(true);
    setError("");
    Promise.all(
      topics.map(async (topic) => {
        try {
          const res = await fetch(`${BASE_URL}?q=${encodeURIComponent(topic)}&sortBy=publishedAt&apiKey=${API_KEY}`);
          const data = await res.json();
          if (data.status === "ok") {
            return { topic, articles: data.articles };
          } else {
            return { topic, articles: [], error: data.message || "Failed to fetch news" };
          }
        } catch (err: any) {
          return { topic, articles: [], error: err.message || "Failed to fetch news" };
        }
      })
    ).then((results) => {
      const news: Record<string, any[]> = {};
      let anyError = "";
      results.forEach(({ topic, articles, error }) => {
        news[topic] = articles;
        if (error && !anyError) anyError = error;
      });
      setNewsByTopic(news);
      setError(anyError);
      setLoading(false);
    });
  }, []);

  // Auto-play functionality
  useEffect(() => {
    if (autoPlayEnabled) {
      topics.forEach(topic => {
        const articles = newsByTopic[topic] || [];
        if (articles.length > 2) { // More than 1 past article
          autoPlayRefs.current[topic] = setInterval(() => {
            setCarouselIndices(prev => {
              const currentIndex = prev[topic] || 0;
              const maxIndex = articles.length - 2;
              return {
                ...prev,
                [topic]: currentIndex >= maxIndex ? 0 : currentIndex + 1
              };
            });
          }, AUTO_PLAY_INTERVAL);
        }
      });
    } else {
      // Clear all intervals
      Object.values(autoPlayRefs.current).forEach(clearInterval);
      autoPlayRefs.current = {};
    }

    return () => {
      Object.values(autoPlayRefs.current).forEach(clearInterval);
    };
  }, [autoPlayEnabled, newsByTopic]);

  const handleCarouselNext = (topic: string) => {
    const articles = newsByTopic[topic] || [];
    const currentIndex = carouselIndices[topic] || 0;
    const maxIndex = articles.length - 2;
    if (currentIndex < maxIndex) {
      setCarouselIndices(prev => ({ ...prev, [topic]: currentIndex + 1 }));
    }
  };

  const handleCarouselPrev = (topic: string) => {
    const currentIndex = carouselIndices[topic] || 0;
    if (currentIndex > 0) {
      setCarouselIndices(prev => ({ ...prev, [topic]: currentIndex - 1 }));
    }
  };

  // Touch handlers for mobile swipe
  const handleTouchStart = (e: React.TouchEvent, topic: string) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = (topic: string) => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) {
      handleCarouselNext(topic);
    } else if (isRightSwipe) {
      handleCarouselPrev(topic);
    }

    setTouchStart(null);
    setTouchEnd(null);
  };

  const handleArticleVisit = (articleUrl: string) => {
    setVisitedArticles(prev => new Set([...prev, articleUrl]));
  };

  const isArticleVisited = (articleUrl: string) => {
    return visitedArticles.has(articleUrl);
  };

  return (
    <Box maxWidth="lg" mx="auto" py={4} px={2}>
      {/* Auto-play toggle */}
      <Box display="flex" justifyContent="center" mb={3}>
        <FormControlLabel
          control={
            <Switch
              checked={autoPlayEnabled}
              onChange={(e) => setAutoPlayEnabled(e.target.checked)}
              size="small"
            />
          }
          label={
            <Box display="flex" alignItems="center" gap={1}>
              {autoPlayEnabled ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
              <Typography variant="body2">Auto-play carousel</Typography>
            </Box>
          }
        />
      </Box>

      <Grid container spacing={3} justifyContent="flex-start" alignItems="flex-start">
        {loading && (
          <Grid item xs={12}>
            <Typography color="text.secondary" align="center" py={6}>Loading...</Typography>
          </Grid>
        )}
        {error && (
          <Grid item xs={12}>
            <Typography color="error" align="center" py={6}>{error}</Typography>
          </Grid>
        )}
        {!loading && !error && topics.length === 0 && (
          <Grid item xs={12}>
            <Typography color="text.secondary" align="center" py={6}>No topics found.</Typography>
          </Grid>
        )}
        {!loading && !error && topics.length > 0 && (
          <>
            {topics.map((topic, idx) => {
              const articles = (newsByTopic[topic] || []).sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
              const latest = articles[0];
              const previous = articles.slice(1);
              const currentCarouselIndex = carouselIndices[topic] || 0;
              const currentPastArticle = previous[currentCarouselIndex];
              const hasMultiplePastArticles = previous.length > 1;

              return (
                <Grid item xs={12} sm={6} md={4} lg={3} xl={2} key={idx}>
                  <Card 
                    variant="outlined" 
                    sx={{ 
                      maxWidth: '550px',
                      borderRadius: 3, 
                      height: '500px', 
                      display: 'flex', 
                      flexDirection: 'column',
                      transition: 'all 0.3s ease-in-out',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: 3
                      }
                    }}
                  >
                    <CardHeader
                      avatar={<Avatar sx={{ bgcolor: 'primary.main' }}><ArticleIcon fontSize="small" /></Avatar>}
                      title={<Typography variant="subtitle1" fontWeight={700} noWrap>{topic}</Typography>}
                      sx={{ pb: 0, pt: 2, px: 2 }}
                    />
                    <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 2, pt: 1 }}>
                      {/* Latest Development */}
                      {latest ? (
                        <Box display="flex" alignItems="flex-start" gap={2} mb={1}>
                          {latest.urlToImage ? (
                            <CardMedia
                              component="img"
                              image={latest.urlToImage}
                              alt={latest.title}
                              sx={{ 
                                width: 50, 
                                height: 50, 
                                borderRadius: 2, 
                                objectFit: 'cover', 
                                boxShadow: 1,
                                transition: 'transform 0.2s ease-in-out',
                                '&:hover': { transform: 'scale(1.05)' }
                              }}
                            />
                          ) : (
                            <Avatar variant="rounded" sx={{ width: 50, height: 50, bgcolor: 'grey.200', color: 'grey.400', fontSize: 10 }}>No Img</Avatar>
                          )}
                          <Box flex={1} minWidth={0}>
                            <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                              <Typography variant="caption" color="primary" fontWeight={700} sx={{ bgcolor: 'primary.light', borderRadius: 1, px: 1, py: 0.2 }}>Latest</Typography>
                              <Typography variant="caption" color="text.secondary">{formatDate(latest.publishedAt)}</Typography>
                              <Typography variant="caption" color="text.secondary" noWrap>{latest.source?.name}</Typography>
                            </Box>
                            <Typography variant="subtitle2" fontWeight={600} noWrap title={latest.title}>{latest.title}</Typography>
                            <Typography variant="body2" color="text.secondary" noWrap title={latest.description}>{latest.description}</Typography>
                            <Button href={latest.url} target="_blank" rel="noopener noreferrer" size="medium" sx={{ mt: 0.5, fontSize: 12, textTransform: 'none' }}>Read more</Button>
                          </Box>
                        </Box>
                      ) : (
                        <Typography color="text.secondary" fontSize={10} align="center">No news found for this topic.</Typography>
                      )}
                      
                      {/* Past Developments Carousel */}
                      {previous.length > 0 && (
                        <Box 
                          mt={1}
                          onTouchStart={(e) => handleTouchStart(e, topic)}
                          onTouchMove={handleTouchMove}
                          onTouchEnd={() => handleTouchEnd(topic)}
                          sx={{ cursor: 'grab', '&:active': { cursor: 'grabbing' } }}
                        >
                          <Divider sx={{ mb: 1 }}>
                            <Box display="flex" alignItems="center" gap={1}>
                              <Typography variant="caption" fontWeight={600}>Past Developments</Typography>
                              {hasMultiplePastArticles && (
                                <Typography variant="caption" color="text.secondary">
                                  ({currentCarouselIndex + 1}/{previous.length})
                                </Typography>
                              )}
                            </Box>
                          </Divider>
                          
                          {/* Carousel Content with smooth transitions */}
                          <Box 
                            position="relative" 
                            minHeight={80}
                            sx={{
                              overflow: 'hidden',
                              '& > *': {
                                transition: 'all 0.3s ease-in-out'
                              }
                            }}
                          >
                            {currentPastArticle && (
                              <Box
                                sx={{
                                  opacity: 1,
                                  transform: 'translateX(0)',
                                  animation: 'slideIn 0.3s ease-in-out',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  height: '100%',
                                  position: 'relative'
                                }}
                              >
                                {/* Visited State Icon - Top Right */}
                                <Box 
                                  position="absolute" 
                                  top={0} 
                                  right={0}
                                  zIndex={1}
                                >
                                  {isArticleVisited(currentPastArticle.url) ? (
                                    <CheckCircleIcon 
                                      fontSize="small" 
                                      sx={{ 
                                        color: 'success.main', 
                                        fontSize: 16,
                                        filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))'
                                      }} 
                                    />
                                  ) : (
                                    <RadioButtonUncheckedIcon 
                                      fontSize="small" 
                                      sx={{ 
                                        color: 'text.disabled', 
                                        fontSize: 16 
                                      }} 
                                    />
                                  )}
                                </Box>

                                {/* Timestamp and Source - Top Left */}
                                <Box display="flex" flexDirection="column" gap={0.5} mb={1}>
                                  <Box display="flex" alignItems="center" gap={0.5}>
                                    <AccessTimeIcon fontSize="small" sx={{ fontSize: 12, color: 'text.secondary' }} />
                                    <Typography variant="caption" color="text.secondary">{formatDate(currentPastArticle.publishedAt)}</Typography>
                                  </Box>
                                  <Box display="flex" alignItems="center" gap={0.5}>
                                    <SourceIcon fontSize="small" sx={{ fontSize: 12, color: 'text.secondary' }} />
                                    <Typography variant="caption" color="text.secondary" noWrap>{currentPastArticle.source?.name}</Typography>
                                  </Box>
                                </Box>
                                
                                {/* Title and Description - Left Side */}
                                <Box flex={1} display="flex" flexDirection="column" gap={0.5} alignItems="flex-start">
                                  <Typography variant="body1" fontWeight={500} title={currentPastArticle.title} sx={{ textAlign: 'left', width: '100%' }}>{currentPastArticle.title}</Typography>
                                  <Typography variant="body2" color="text.secondary" title={currentPastArticle.description} sx={{ textAlign: 'left', width: '100%' }}>{currentPastArticle.description}</Typography>
                                </Box>
                                
                                {/* Read More Link - Bottom Right */}
                                <Box display="flex" justifyContent="flex-end" mt={1}>
                                  <Button 
                                    href={currentPastArticle.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    size="medium" 
                                    sx={{ fontSize: 12, textTransform: 'none' }}
                                    onClick={() => handleArticleVisit(currentPastArticle.url)}
                                  >
                                    Read more
                                  </Button>
                                </Box>
                              </Box>
                            )}
                          </Box>
                          
                          {/* Carousel Navigation - Fixed Below Content */}
                          {hasMultiplePastArticles && (
                            <Box 
                              display="flex" 
                              justifyContent="center" 
                              alignItems="center" 
                              gap={1} 
                              mt={1}
                              sx={{ 
                                borderTop: 1, 
                                borderColor: 'grey.200', 
                                pt: 1 
                              }}
                            >
                              <IconButton
                                size="small"
                                onClick={() => handleCarouselPrev(topic)}
                                disabled={currentCarouselIndex === 0}
                                sx={{ 
                                  bgcolor: 'background.paper', 
                                  boxShadow: 1,
                                  transition: 'all 0.2s ease-in-out',
                                  '&:hover': { 
                                    bgcolor: 'background.paper',
                                    transform: 'scale(1.1)'
                                  },
                                  '&.Mui-disabled': { opacity: 0.3 }
                                }}
                              >
                                <ChevronLeftIcon fontSize="small" />
                              </IconButton>
                              <Typography variant="caption" color="text.secondary">
                                {currentCarouselIndex + 1} / {previous.length}
                              </Typography>
                              <IconButton
                                size="small"
                                onClick={() => handleCarouselNext(topic)}
                                disabled={currentCarouselIndex >= previous.length - 1}
                                sx={{ 
                                  bgcolor: 'background.paper', 
                                  boxShadow: 1,
                                  transition: 'all 0.2s ease-in-out',
                                  '&:hover': { 
                                    bgcolor: 'background.paper',
                                    transform: 'scale(1.1)'
                                  },
                                  '&.Mui-disabled': { opacity: 0.3 }
                                }}
                              >
                                <ChevronRightIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          )}
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </>
        )}
      </Grid>

      {/* CSS for animations */}
      <style>
        {`
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateX(20px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
        `}
      </style>
    </Box>
  );
};

export default Home;