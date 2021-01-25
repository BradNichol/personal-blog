import React from "react"
import Card from "../components/card"
import Layout from "../components/layout"


function Projects() {
  return (
    <Layout>
      <Card 
        title="Project 1"
        description="Lorem ipsum dolor sit amet, consectetur adipisicing elit. 
        Voluptatibus quia, nulla! Maiores et perferendis eaque, exercitationem 
        praesentium nihil."
        tag1="React"
        tag2="Express"
        tag3="AWS" />
    </Layout>
  )
}

export default Projects
