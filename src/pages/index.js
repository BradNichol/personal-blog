import React from "react"
import { Link } from "gatsby"

import Layout from "../components/layout"
import SEO from "../components/seo"
import Button from "../components/button"
import Carousel from "../components/carousel";

class IndexPage extends React.Component {
  render() {
    const siteTitle = " Bradley Nichol"

    return (
      <Layout location={this.props.location}>
        <SEO
          title={siteTitle}
          keywords={[`blog`, `gatsby`, `javascript`, `react`]}
        />
        <h1>Hi, I'm Bradley Nichol</h1>
        
        <p>I'm a software developer based in Leyland, Lancashire,
          working for a FTSE100 company in the automotive industry. I predominately
          work on backend systems using Java, with a sprinkle of frontend Angular work for 
          internal tools.
        </p>
        <p>
          In my past life I was a digital marketing professional for many years, and after
          nearly two years of self-development I successfully transitioned into a software
          development career. 
        </p>
        <p>
          I'm sharing my thoughts, journey and whatever I'm learning here. 
        </p>
        <p>
          Thanks for stopping by.
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
