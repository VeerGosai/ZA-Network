# South Africa Network Visualization

https://veergosai.github.io/ZA-Network/

An interactive visualization tool for exploring network interconnections between Internet Exchanges, service providers, and companies across South Africa.


## Overview

This tool provides a dynamic, force-directed graph visualization of South Africa's internet infrastructure, focusing on:

- Internet Exchange Points (IXPs)
- Network service providers
- Companies and their connections
- Connection speeds and relationships

## Features

- **Interactive Graph**: Drag, zoom, and explore network connections
- **Advanced Filtering**: Filter by Internet Exchange to focus your view
- **Search Functionality**: Quickly find specific nodes by name
- **Connection Details**: View detailed information about nodes and their connections
- **Speed Indicators**: Color-coded connections based on network speeds
- **Internal IX Structure**: Detailed views of major Internet Exchanges' internal topology
- **Weather Map Integration**: Links to live traffic data on the INX portal

## Data Sources

The visualization uses three primary data sources:

- `data.csv`: Network node data including ASNs, IPs, speeds, and exchange relationships
- `companies.csv`: Company information
- `ix.csv`: Internet Exchange points in South Africa

## Getting Started

### Prerequisites

No installation required! This is a browser-based application.

### Usage

1. Open `index.html` in a modern web browser
2. Use the left panel to filter by Internet Exchange
3. Use the search box to find specific nodes
4. Click on nodes to view detailed information
5. Explore connections by hovering and clicking

### Navigation Tips

- **Zoom**: Use mouse wheel, pinch gestures, or the zoom controls
- **Pan**: Click and drag the background to move around
- **Select**: Click on any node to see its details and connections
- **Explore**: Click on highlighted connections to navigate through the network

## Internet Exchange Internal Structures

The following Internet Exchanges have detailed internal structure views:

- **JINX**: Johannesburg Internet Exchange with multiple data centers
- **CINX**: Cape Town Internet Exchange with connections between three locations
- **DINX**: Durban Internet Exchange with RVH and UMH locations
- **NMBINX**: Nelson Mandela Bay Internet Exchange

## Visual Guide

- **Red Circles**: Internet Exchange Points
- **Blue Circles**: Network Nodes
- **Orange Circles**: Company Nodes
- **Yellow/Orange/Red/Black Lines**: Network connections (speed-coded)

## Connection Speed Legend

- Yellow: ≤ 1 Gbps
- Orange: 1.1-10 Gbps
- Red: 10.1-100 Gbps
- Black: > 100 Gbps
- Gray: Unknown speed

## Attribution

This visualization is based on data from the Internet exchange points in South Africa and provides a window into the interconnected nature of the country's internet infrastructure.
