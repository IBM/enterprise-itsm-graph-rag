# Images for Tutorial

This folder should contain the following images for the tutorial:

## Required Images

### 1. architecture-diagram.png

**Description**: High-level system architecture diagram showing the three-tier structure.

**Components to include**:
- **Data Layer**: Astra DB icon with "1,370 ITSM documents" and "1024d vectors" labels
- **Backend Layer**: FastAPI icon with two pipelines:
  - Normal RAG: "Vector Search → Top-5 → LLM"
  - Graph RAG: "Vector Search → BFS Traversal → Top-10 → LLM"
- **Frontend Layer**: React + Carbon Design System icon with "Side-by-side comparison" and "D3.js graph visualization"
- **Deployment**: Docker container icon showing "nginx (port 9000) + uvicorn (port 8000) + supervisord"

**Arrows showing data flow**:
1. User query → Frontend
2. Frontend → Backend (parallel requests to /query/normal and /query/graph)
3. Backend → Astra DB (vector search)
4. Backend → IBM watsonx (embeddings + LLM)
5. Backend → Frontend (responses with answers and traversal path)
6. Frontend → D3.js visualization

**Suggested tool**: Draw.io, Lucidchart, or Figma

**Draw.io XML structure** (for reference):

```xml
<mxGraphModel>
  <root>
    <!-- Data Layer -->
    <mxCell id="astra-db" value="Astra DB&#xa;1,370 ITSM Documents&#xa;1024d Vectors" style="shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;size=15;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="1">
      <mxGeometry x="320" y="400" width="160" height="80" as="geometry"/>
    </mxCell>
    
    <!-- Backend Layer -->
    <mxCell id="fastapi" value="FastAPI Backend" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;" vertex="1" parent="1">
      <mxGeometry x="280" y="240" width="240" height="60" as="geometry"/>
    </mxCell>
    
    <mxCell id="normal-rag" value="Normal RAG&#xa;Vector Search → Top-5" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;" vertex="1" parent="1">
      <mxGeometry x="200" y="160" width="140" height="50" as="geometry"/>
    </mxCell>
    
    <mxCell id="graph-rag" value="Graph RAG&#xa;Vector + BFS → Top-10" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffe6cc;strokeColor=#d79b00;" vertex="1" parent="1">
      <mxGeometry x="460" y="160" width="140" height="50" as="geometry"/>
    </mxCell>
    
    <!-- Frontend Layer -->
    <mxCell id="frontend" value="React + Carbon Design System&#xa;Side-by-side Comparison&#xa;D3.js Graph Visualization" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#e1d5e7;strokeColor=#9673a6;" vertex="1" parent="1">
      <mxGeometry x="280" y="40" width="240" height="80" as="geometry"/>
    </mxCell>
    
    <!-- IBM watsonx -->
    <mxCell id="watsonx" value="IBM watsonx&#xa;Embeddings + LLM" style="ellipse;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;" vertex="1" parent="1">
      <mxGeometry x="600" y="240" width="140" height="80" as="geometry"/>
    </mxCell>
    
    <!-- Docker Container -->
    <mxCell id="docker" value="Docker Container&#xa;nginx (9000) + uvicorn (8000)&#xa;supervisord" style="shape=note;whiteSpace=wrap;html=1;backgroundOutline=1;darkOpacity=0.05;fillColor=#f5f5f5;strokeColor=#666666;" vertex="1" parent="1">
      <mxGeometry x="40" y="40" width="160" height="100" as="geometry"/>
    </mxCell>
    
    <!-- Arrows -->
    <mxCell id="arrow1" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=1;exitDx=0;exitDy=0;entryX=0.5;entryY=0;entryDx=0;entryDy=0;" edge="1" parent="1" source="frontend" target="fastapi">
      <mxGeometry relative="1" as="geometry"/>
    </mxCell>
    
    <mxCell id="arrow2" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=1;exitDx=0;exitDy=0;entryX=0.5;entryY=0;entryDx=0;entryDy=0;entryPerimeter=0;" edge="1" parent="1" source="fastapi" target="astra-db">
      <mxGeometry relative="1" as="geometry"/>
    </mxCell>
    
    <mxCell id="arrow3" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=1;exitY=0.5;exitDx=0;exitDy=0;entryX=0;entryY=0.5;entryDx=0;entryDy=0;" edge="1" parent="1" source="fastapi" target="watsonx">
      <mxGeometry relative="1" as="geometry"/>
    </mxCell>
  </root>
</mxGraphModel>
```

### Color Scheme
Use professional, accessible colors:
- Data Layer: Light blue (#dae8fc)
- Backend: Light green (#d5e8d4)
- Frontend: Light purple (#e1d5e7)
- IBM watsonx: Light red/pink (#f8cecc)
- Containers: Light gray (#f5f5f5)

### Dimensions
- Recommended size: 1200px × 800px
- Format: PNG with transparent background
- Resolution: 150 DPI for web display

## Creating the Diagram

### Option 1: Draw.io (Recommended)
1. Go to [app.diagrams.net](https://app.diagrams.net/)
2. Create a new diagram
3. Use the XML structure above as a starting point
4. Customize with proper icons and labels
5. Export as PNG

### Option 2: Lucidchart
1. Sign in to [Lucidchart](https://www.lucidchart.com/)
2. Create a new document
3. Use shapes library: AWS, Azure, or Generic icons
4. Follow the component structure above
5. Export as PNG

### Option 3: Figma
1. Open [Figma](https://www.figma.com/)
2. Create a new design file
3. Use the component structure above
4. Add icons from Figma community (search for "database", "API", "React")
5. Export as PNG

## Notes
- Ensure all text is readable at 100% zoom
- Use consistent icon styles throughout
- Include a legend if using multiple arrow types
- Test the image in both light and dark themes