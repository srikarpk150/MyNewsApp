import { StyleSheet, Text, View, SafeAreaView, ScrollView, TouchableOpacity, Image, ActivityIndicator, RefreshControl } from 'react-native';
import React, { useContext, useState, useEffect, useCallback } from 'react';
import { AppwriteContext } from '../appwrite/appwritecontext';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RouteParamList } from '../Routes/path';
import NewsService from '../newsapi/apicalls';
import Title from '@/components/title';

type BrowseScreenProps = NativeStackScreenProps<RouteParamList, 'BrowseScreen'>;

type UserObj = {
  name: String;
  email: String;
};

type NewsArticle = {
  url: string;
  title: string;
  author?: string;
  content?: string;
  urlToImage?: string;
  description: string;
  publishedAt: string;
  source?: { id?: string; name: string;};
};


const Browse = ({ navigation }: BrowseScreenProps) => {
  const [userData, setUserData] = useState<UserObj>();
  const [newsData, setNewsData] = useState<Record<string, NewsArticle[]>>({});
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const { appwrite, setIsLoggedIn } = useContext(AppwriteContext);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showSnackbar = (message: string) => {
    setSnackbarMessage(message);
    setSnackbarVisible(true);
  };

  const categories = [
    "Corporate/Industry Events",
    "Ideas Festivals",
    "Political Events",
    "Social Events",
    "Lifestyle Expos",
    "Cultural Events",
    "Galas and Awards",
    "Education and Training Workshops",
    "Listening and Community Events",
  ];

  const toggleCategory = useCallback((category: string) => {
    setSelectedCategories(prev => {
      const updatedCategories = prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category];

      saveCategoriesToDatabase(updatedCategories);
      return updatedCategories;
    });
  }, []);

  const saveCategoriesToDatabase = async (categories: string[]) => {
    try {
      const user = await appwrite.getCurrentUser();
      if (user && user.$id) {
        const userId = user.$id;
  
        if (documentId) {
          await appwrite.savepreferences(
            {
              documentid: documentId,
              userid: userId,
              categories: { interested_categories: categories },
            },
            showSnackbar
          );
        } else {
          const response = await appwrite.createpreferences(
            {
              userid: userId,
              categories: { interested_categories: categories },
            },
            showSnackbar
          );
  
          if (response && response.$id) {
            setDocumentId(response.$id);
          } else {
            console.log('Error: response from createpreferences is undefined');
          }
        }
  
        showSnackbar("Preferences updated successfully");
      }
    } catch (error) {
      console.log('Error saving categories:', error);
    }
  };

  const loadSavedCategories = async () => {
    try {
        const user = await appwrite.getCurrentUser();
        if (user && user.$id) {
            const userId = user.$id;
            const response = await appwrite.getpreferences(
                { userid: userId },
                showSnackbar
            );

            if (response) {
                setSelectedCategories(response.interested_categories);
                setDocumentId(response.$id);
            } else {
                setSelectedCategories([]);
                setDocumentId(null);
            }
        }
    } catch (error) {
        console.log('Error fetching saved categories:', error);
    }
  };

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadSavedCategories();
      setError(null);
    } catch (error) {
      setError('Failed to refresh data');
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    appwrite.getCurrentUser()
      .then(response => {
        if (response) {
          const user: UserObj = {
            name: response.name,
            email: response.email
          };
          setIsLoggedIn(true);
          setUserData(user);
          loadSavedCategories();
        }
      });
  }, [appwrite]);

  useEffect(() => {
    const fetchNewsData = async () => {
      setIsLoading(true);
      setError(null);
      const newsService = new NewsService();
      const categoryData: Record<string, NewsArticle[]> = {};

      try {
        for (const category of selectedCategories) {
          const response = await newsService.getCategoryNewsFromAPI([category]);
          if (response && response[category]) {
            categoryData[category] = response[category].slice(0, 20);
          }
        }
        setNewsData(categoryData);
      } catch (error) {
        setError('Failed to fetch news');
        showSnackbar('Error loading news');
      } finally {
        setIsLoading(false);
      }
    };

    if (selectedCategories.length > 0) {
      fetchNewsData();
    }
  }, [selectedCategories]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.contentWrapper}>
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
          }
        >
          <Title />
          
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Text style={styles.sectionTitle}>Select Categories:</Text>
          <View style={styles.categoriesContainer}>
            {categories.map((category, index) => (
              <TouchableOpacity 
                key={index} 
                onPress={() => toggleCategory(category)} 
                style={[
                  styles.categoryButton,
                  selectedCategories.includes(category) && styles.categoryButtonSelected
                ]}
              >
                <Text style={styles.categoryText}>{category}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.newsContainer}>
            {isLoading ? (
              <ActivityIndicator size="large" color="#FF4500" />
            ) : selectedCategories.length === 0 ? (
              <Text style={styles.emptyStateText}>
                Select categories to see news
              </Text>
            ) : Object.keys(newsData).length === 0 ? (
              <Text style={styles.emptyStateText}>
                No news found for selected categories
              </Text>
            ) : (
              Object.keys(newsData).map((category) => (
                <View key={category} style={styles.articleCategoryContainer}>
                  <Text style={styles.sectionTitle}>{category}</Text>
                  <ScrollView horizontal >
                    {newsData[category].map((article, index) => (
                      <TouchableOpacity 
                        key={index} 
                        style={styles.articleContainer} 
                        onPress={() => navigation.navigate('Detail', { article })}
                      >
                        {article.urlToImage && (
                          <Image
                            source={{ uri: encodeURI(article.urlToImage) }}
                            style={styles.articleImageSmall}
                            resizeMode="cover"
                          />
                        )}
                        <View style={styles.articleTextContainer}>
                          <Text style={styles.articleTitle}>{article.title}</Text>
                          <Text style={styles.articleDate}>
                            Published on: {new Date(article.publishedAt).toLocaleDateString()}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  contentWrapper: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 25,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FF4500',
    marginBottom: 12,
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 24,
  },
  categoryButton: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: '#2A2E43',
    margin: 6,
  },
  categoryButtonSelected: {
    backgroundColor: '#FF4500',
  },
  categoryText: {
    color: '#E0E0E0',
    fontSize: 15,
  },
  newsContainer: {
    width: '100%',
    alignItems: 'center',
  },
  articleCategoryContainer: {
    width: '100%',
    marginBottom: 24,
  },
  horizontalScrollContent: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    paddingHorizontal: 10,
  },
  articleContainer: {
    backgroundColor: 'rgba(18, 18, 18, 0.8)',
    padding: 20,
    borderRadius: 15,
    marginHorizontal: 10,
    width: 300,
    flexDirection: 'column',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 6,
  },
  articleTextContainer: {
    flex: 1,
    marginTop: 10,
  },
  articleImageSmall: {
    width: 180,
    height: 100,
    borderRadius: 8,
    marginBottom: 10,
  },
  articleTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  articleDate: {
    fontSize: 12,
    color: '#A9A9A9',
    marginTop: 10,
    textAlign: 'center',
  },
  errorContainer: {
    padding: 10,
    backgroundColor: '#FF000020',
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#FF0000',
    textAlign: 'center',
  },
  emptyStateText: {
    color: '#A9A9A9',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
  },
});

export default Browse;
