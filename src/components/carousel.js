import React, { useState } from "react"
import Carousel from "react-material-ui-carousel"
import Card from "@material-ui/core/Card"
//import CardActions from "@material-ui/core/CardActions"
import CardContent from "@material-ui/core/CardContent"
// import Button from "@material-ui/core/Button"

function CarouselSlider() {
  const [items, setItems] = useState([
      {
          title: 'Personal blog',
          lastUpdated: "05-05-2020"
      },
      {
        title: 'SharedBread',
        lastUpdated: "028-05-2020"
    }
    ])

  return (
      <Carousel>
          {items.map(item => {
              return (
                  <Card>
                      <CardContent>
                          {item.title}
                      </CardContent>
                  </Card>
              )
          })}
      </Carousel>
  )
}

export default CarouselSlider
