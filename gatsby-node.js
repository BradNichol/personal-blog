const path = require(`path`)
const { createFilePath } = require(`gatsby-source-filesystem`)
const slugify = require('slugify');

exports.createPages = ({ graphql, actions }) => {
  const { createPage } = actions

  const blogPost = path.resolve(`./src/templates/blog-post.js`)
  return graphql(
    `
      {
        allMdx(
          sort: { fields: [frontmatter___date], order: DESC }
          limit: 1000
        ) {
          edges {
            node {
              fields {
                slug
              }
              frontmatter {
                title
                category
              }
            }
          }
        }
      }
    `
  ).then(result => {
    if (result.errors) {
      throw result.errors
    }

    // Create blog posts pages.
    const posts = result.data.allMdx.edges

    posts.forEach((post, index) => {
      const previous = index === posts.length - 1 ? null : posts[index + 1].node
      const next = index === 0 ? null : posts[index - 1].node

      createPage({
        path: `blog${post.node.fields.slug}`,
        component: blogPost,
        context: {
          slug: post.node.fields.slug,
          previous,
          next,
        },
      })
    })

    // collect categories

    const categoriesFound = []
    posts.forEach(post => {
      post.node.frontmatter.category.forEach(category => {
        if (categoriesFound.indexOf(category) === -1) {
          categoriesFound.push(category)
        }
      })
    })

    // create a page for each category
    const categories = [...new Set(categoriesFound)]
    categories.forEach(category => {
      const slug = slugify(category);
      createPage({
        path: `category/${slug.toLowerCase()}`,
        component: path.resolve("./src/templates/category-page.js"),
        context: {
          category: category,
        },
      })
    })

    return null
  })
}

exports.onCreateNode = ({ node, actions, getNode }) => {
  const { createNodeField } = actions

  if (node.internal.type === "Mdx") {
    const value = createFilePath({ node, getNode })
    createNodeField({
      name: "slug",
      node,
      value,
    })
  }
}
