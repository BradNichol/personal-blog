import React from "react"
import { Link } from "gatsby"

import Layout from "../components/layout"
import SEO from "../components/seo"
import Button from "../components/button"

class IndexPage extends React.Component {
  render() {
    const siteTitle = "Bradley Nichol"

    return (
      <Layout location={this.props.location} title={siteTitle}>
        <SEO
          title={siteTitle}
          keywords={[`blog`, `gatsby`, `javascript`, `react`]}
        />
        
        <h2>Software Developer</h2>
        <p>Welcome to my personal blog which is
          currently under development. Check back  soon.
        </p>
        <Link to="/blog/">
          <Button marginTop="35px">View Blog Posts</Button>
        </Link>
      </Layout>
    )
  }
}

export default IndexPage
