'use client'

import React from "react";
import Header from "../components/header";
import { useApi } from "../hooks/useApi";
import LoadingSpinner from "../loading";

export default function SportsPage() {

    const { data, loading, error, request } = useApi();


    React.useEffect(() => {
        const fetchData = async () => {
            try {
                await request(
                    "https://newsapi.org/v2/everything?q=Air India Flight 171&from=2025-06-25&sortBy=publishedAt",
                    {
                        headers: {
                            "X-Api-Key": process.env.NEWS_API_KEY || "959fbf4b91d94ab3b936fcfe10ed6213",
                        }
                    }
                );
                console.log(data);
            } catch (error) {
                console.error("Error fetching data:", error);
            }
        };

        fetchData();
    }, []);

    if (loading) return <LoadingSpinner />;
    if (error) return <div>Error: {error.message}</div>;

    return (
        <div>
            <Header />
            <div className="block w-full h-full overflow-auto p-6 mt-24 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-100 dark:bg-gray-800 dark:border-gray-700 dark:hover:bg-gray-700">
                { data && data.articles && data.articles.length > 0 ? (
                    data.articles.map((article: any, index: number) => (
                        <div key={index} className="mb-4">                            
                            <p>
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                    {new Date(article.publishedAt).toLocaleDateString()} - {new Date(article.publishedAt).toLocaleTimeString()}
                                </span>                                
                            </p>
                            <span>
                                {article.source.name}
                            </span>
                            <p className="mb-2 text-base font-bold tracking-tight text-gray-700 dark:text-white">
                                {article.title}
                            </p>
                            <p className="text-sm text-gray-700 dark:text-gray-400">
                                {article.description}
                            </p>
                            <a href={article.url} className="font-small text-blue-600 dark:text-blue-500 hover:underline">Read more</a>
                            <img
                                src={article.urlToImage}
                                alt={article.title}
                                className="mt-2 w-24 h-24 object-cover rounded-lg"
                                style={{ maxWidth: '96px', maxHeight: '96px' }}
                            />
                        </div>
                    ))
                ) : (
                    <p>No articles found.</p>
                )}
            </div>
        </div>
    );
}