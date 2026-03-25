/**
 * Graph Traversal Visualization Component
 * Uses D3.js to render the knowledge graph traversal path
 */

import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Tag } from '@carbon/react';

const NODE_COLORS = {
  incident: '#da1e28',       // Carbon Red 60
  problem_record: '#ff832b', // Carbon Orange 40
  change_request: '#0f62fe', // Carbon Blue 60
  configuration_item: '#198038', // Carbon Green 60
  business_service: '#8a3ffc', // Carbon Purple 60
  kb_article: '#0072c3',     // Carbon Cyan 60
  unknown: '#6f6f6f',        // Carbon Gray 50
};

const NODE_LABELS = {
  incident: 'INC',
  problem_record: 'PRB',
  change_request: 'CHG',
  configuration_item: 'CI',
  business_service: 'SVC',
  kb_article: 'KB',
  unknown: '?',
};

const GraphVisualization = ({ traversalPath = [] }) => {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!traversalPath || traversalPath.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = svgRef.current.clientWidth || 700;
    const height = 400;

    svg.attr('width', width).attr('height', height);

    // Build nodes and links from traversal path
    const nodes = traversalPath.map((node, i) => ({
      id: node.node_id,
      type: node.node_type,
      depth: node.depth,
      content: node.content,
      index: i,
    }));

    // Create links between consecutive nodes at different depths
    const links = [];
    for (let i = 1; i < nodes.length; i++) {
      const parent = nodes.find(n => n.depth === nodes[i].depth - 1);
      if (parent) {
        links.push({ source: parent.id, target: nodes[i].id });
      }
    }

    // Create simulation
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(120))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('x', d3.forceX(d => (d.depth + 1) * (width / (Math.max(...nodes.map(n => n.depth)) + 2))).strength(0.5))
      .force('y', d3.forceY(height / 2).strength(0.1));

    // Add arrow marker
    svg.append('defs').append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 25)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 8)
      .attr('markerHeight', 8)
      .append('path')
      .attr('d', 'M 0,-5 L 10 ,0 L 0,5')
      .attr('fill', '#8d8d8d');

    // Draw links
    const link = svg.append('g')
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', '#8d8d8d')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '5,3')
      .attr('marker-end', 'url(#arrowhead)');

    // Draw node groups
    const node = svg.append('g')
      .selectAll('g')
      .data(nodes)
      .enter()
      .append('g')
      .attr('cursor', 'pointer')
      .call(d3.drag()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
      );

    // Node circles
    node.append('circle')
      .attr('r', 22)
      .attr('fill', d => NODE_COLORS[d.type] || NODE_COLORS.unknown)
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .attr('opacity', 0.9);

    // Depth badge
    node.append('circle')
      .attr('r', 8)
      .attr('cx', 16)
      .attr('cy', -16)
      .attr('fill', '#161616')
      .attr('stroke', '#fff')
      .attr('stroke-width', 1);

    node.append('text')
      .attr('x', 16)
      .attr('y', -16)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('fill', '#fff')
      .attr('font-size', '9px')
      .attr('font-weight', 'bold')
      .text(d => d.depth);

    // Node type label
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('fill', '#fff')
      .attr('font-size', '10px')
      .attr('font-weight', 'bold')
      .text(d => NODE_LABELS[d.type] || '?');

    // Tooltip
    const tooltip = d3.select('body').append('div')
      .attr('class', 'graph-tooltip')
      .style('position', 'absolute')
      .style('background', '#161616')
      .style('color', '#f4f4f4')
      .style('padding', '8px 12px')
      .style('border-radius', '4px')
      .style('font-size', '12px')
      .style('max-width', '300px')
      .style('pointer-events', 'none')
      .style('opacity', 0)
      .style('z-index', 1000);

    node.on('mouseover', (event, d) => {
      tooltip.transition().duration(200).style('opacity', 0.95);
      tooltip.html(`
        <strong>${d.type.replace('_', ' ').toUpperCase()}</strong><br/>
        <span style="color:#8d8d8d">Depth: ${d.depth}</span><br/>
        ${d.content.substring(0, 150)}...
      `)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 28) + 'px');
    })
    .on('mouseout', () => {
      tooltip.transition().duration(500).style('opacity', 0);
    });

    // Update positions on tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    // Cleanup tooltip on unmount
    return () => {
      d3.selectAll('.graph-tooltip').remove();
    };
  }, [traversalPath]);

  if (!traversalPath || traversalPath.length === 0) {
    return (
      <div style={{
        padding: '2rem',
        textAlign: 'center',
        color: '#6f6f6f',
        border: '1px dashed #393939',
        borderRadius: '4px'
      }}>
        <p>No graph traversal data available.</p>
        <p style={{ fontSize: '0.875rem' }}>Run a Graph RAG query to see the traversal visualization.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
        {Object.entries(NODE_COLORS).filter(([k]) => k !== 'unknown').map(([type, color]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              backgroundColor: color
            }} />
            <span style={{ fontSize: '0.75rem', color: '#c6c6c6' }}>
              {type.replace('_', ' ')}
            </span>
          </div>
        ))}
      </div>

      {/* Traversal stats */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
        <Tag type="blue">Nodes: {traversalPath.length}</Tag>
        <Tag type="green">
          Max Depth: {Math.max(...traversalPath.map(n => n.depth))}
        </Tag>
      </div>

      {/* D3 Graph */}
      <div style={{
        background: '#262626',
        borderRadius: '4px',
        overflow: 'hidden',
        border: '1px solid #393939'
      }}>
        <svg
          ref={svgRef}
          style={{ width: '100%', height: '400px', display: 'block' }}
        />
      </div>
    </div>
  );
};

export default GraphVisualization;

