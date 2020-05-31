import React from "react"
import { Link } from "gatsby"

import Layout from "../components/layout"
import SEO from "../components/seo"
import Button from "../components/button"
import Carousel from "../components/carousel";

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
        <h2>My Recent Repos</h2>
        <Carousel />
      </Layout>
    )
  }
}

export default IndexPage
