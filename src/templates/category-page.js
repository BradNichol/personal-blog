import React from "react"
import { Link, graphql } from "gatsby"
import Layout from "../components/layout"
import { rhythm } from "../utils/typography"

export default ({ data, pageContext }) => {
  const posts = data.allMdx.nodes
  const category = pageContext.category
  return (
    <Layout location={data.location}>
      <h1>{category}</h1>
      {posts.map(post => (
        <div key={post.fields.slug}>
        <h3
          style={{
            marginBottom: rhythm(1 / 4),
          }}
        >
          <Link
            style={{ boxShadow: `none` }}
            to={`blog${post.fields.slug}`}
          >
            {post.frontmatter.title}
          </Link>
        </h3>
        <small>{post.frontmatter.date}</small>
        <p
          dangerouslySetInnerHTML={{
            __html: post.frontmatter.description || post.excerpt,
          }}
        />
      </div>
      ))}
    </Layout>
  )
}
export const query = graphql`
  query CategoryPage($category: String!) {
    allMdx(filter: { frontmatter: { category: { eq: $category } } }) {
      nodes {
        excerpt
        fields {
          slug
        }
        frontmatter {
          title
          date(formatString: "MMMM DD, YYYY")
        }
      }
    }
  }
`
