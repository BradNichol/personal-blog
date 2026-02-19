import React from "react"
import Layout from "../components/layout"
import SEO from "../components/seo"

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

        <p>
          <strong>
            Senior Backend Engineer. Pragmatic Builder. Clean Code Advocate.
          </strong>
        </p>
        <p>
          I'm a career changer turned senior Java developer in a FTSE 100
          environment. No formal CS background. Six years of building and
          shipping features inside large enterprise systems, working across
          backend services and data-focused engineering teams.
        </p>
        <p>
          I care deeply about clean architecture, readable code, and strong guard
          rails. Slop -- human or AI -- isn't acceptable. Discipline still
          matters.
        </p>
        <p>
          I'm not a coding savant and I don't aspire to be one. I enjoy building
          useful features that fit coherently into larger systems. Structure,
          clarity, and long-term maintainability are what interest me.
        </p>
        <p>
          Recently I've been exploring agentic development and modern AI tooling
          in real production contexts. Not chasing hype. Not replacing
          engineering judgment. Using AI as an amplifier -- not a shortcut.
        </p>
      </Layout>
    )
  }
}

export default IndexPage
