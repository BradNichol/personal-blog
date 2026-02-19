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
          keywords={[`java`, `software engineering`, `clean code`]}
        />
        <h1>Hi, I'm Bradley Nichol</h1>

        <p>
          <strong>
            Senior Backend Engineer. Pragmatic Builder. Clean Code Janitor 🧹.
          </strong>
        </p>
        <p>
          I’m a career changer turned Senior Java Developer in a FTSE 100 company. I don't have a CS degree, but I do have six years of battle scars 
          from shipping features inside an enterprise machine. I've survived both the backend trenches and the data engineering wild west.
        </p>
        <p>
        I have an affection for clean architecture and other guard rails. 'Slop'—whether hand-cranked by human or by Mr Robot, is a no!
        </p>
        <p>
          I'm not a coding savant and I don't aspire to be one. I enjoy building
          useful features that fit coherently into larger systems. Structure,
          clarity, and long-term maintainability are what interest me.
          An investigation ticket, yes please!
        </p>
        <p>
          Recently I've been exploring agentic development (big up to Codex!) and AI tooling
          in personal projects. Trying not to chase hype. Not replacing
          engineering judgment. Leveraging AI as an amplifier -- not a shortcut.
        </p>
      </Layout>
    )
  }
}

export default IndexPage
