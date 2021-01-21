import React from 'react';
import { graphql } from 'gatsby';
import Layout from '../components/layout';

export default ({ data, pageContext }) => {
  const posts = data.allMdx.nodes;
  const categories = pageContext.categories;
  return (
    <Layout location={data.location}>

    
      <h1>{categories}</h1>
      {posts.map(post => (
        <h3>{post.frontmatter.title}</h3>
      ))}
    </Layout>
  );
};
export const query = graphql`
  query CategoryPage($categories: String!) {
    allMdx(filter: { frontmatter: { categories: { eq: $categories } } }) {
      nodes {
        frontmatter {
          title
          categories
        }
      }
    }
  }
`;