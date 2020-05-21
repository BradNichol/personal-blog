import React, { useState } from "react"
import AppBar from "@material-ui/core/AppBar"
import Drawer from "@material-ui/core/Drawer"
import Toolbar from "@material-ui/core/Toolbar"
import IconButton from "@material-ui/core/IconButton"
import MenuIcon from "@material-ui/icons/Menu"
import List from "@material-ui/core/List"
import ListItem from "@material-ui/core/ListItem"
import ListItemText from "@material-ui/core/ListItemText"
import ChevronLeftIcon from '@material-ui/icons/ChevronLeft';
import { Link } from "gatsby"

function NavigationBar() {
  const [open, setOpen] = useState(false)

  const handleDrawerOpen = () => {
    setOpen(true)
  }

  const handleDrawerClose = () => {
    setOpen(false)
  }

  const drawerInfo = (
    <div>
      <List>
        {["Home", "Blog"].map(text => (
          <ListItem button key={text} component={Link} to={text === 'Home' ? '/' : '/blog'}>
            <ListItemText primary={text} />
          </ListItem>
        ))}
      </List>
    </div>
  )
  return (
    <>
      <AppBar style={{backgroundColor: '#373737'}} position="fixed">
        <Toolbar>
          <IconButton color="inherit" aria-label="open drawer" edge="start" onClick={handleDrawerOpen}>
            <MenuIcon />
          </IconButton>
          BN
        </Toolbar>
      </AppBar>
      <Drawer anchor={"left"} open={open}>
      <IconButton onClick={handleDrawerClose}>
            <ChevronLeftIcon />
          </IconButton>
        {drawerInfo}
      </Drawer>
    </>
  )
}

export default NavigationBar
