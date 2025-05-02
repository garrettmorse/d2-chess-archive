import json
import numpy as np
import matplotlib.pyplot as plt
from os.path import abspath
# 1. Load the JSON tile data
jsonfile = abspath('../common/tj-data-best.json')
with open(jsonfile) as f:
    data = json.load(f)

# 2. Precompute tile edges and border flags
def is_uniform_edge(edge):
    """Check if an edge (list of 8 symbols) is 'border' (all non-None symbols identical)."""
    symbols = [s for s in edge if s is not None]
    return len(symbols) > 0 and all(sym == symbols[0] for sym in symbols)

# Extract edges for each tile and note which sides are border edges
edges = {}  # edges[tile_id] = {'top':..., 'bottom':..., 'left':..., 'right':...}
border_flags = {}  # border_flags[tile_id] = {'top':bool, 'bottom':bool, 'left':bool, 'right':bool}
for tile_id, tile_info in data.items():
    grid = tile_info['symbols']
    top_edge    = tuple(grid[0])                              # top row of the 8x8 tile
    bottom_edge = tuple(grid[-1])                             # bottom row
    left_edge   = tuple(row[0] for row in grid)               # first column
    right_edge  = tuple(row[-1] for row in grid)              # last column
    edges[tile_id] = {'top': top_edge, 'bottom': bottom_edge,
                      'left': left_edge, 'right': right_edge}
    border_flags[tile_id] = {
        'top':    is_uniform_edge(top_edge),
        'bottom': is_uniform_edge(bottom_edge),
        'left':   is_uniform_edge(left_edge),
        'right':  is_uniform_edge(right_edge)
    }

# 3. Assemble the puzzle
N = 64  # grid size in tiles (64x64)
placement = [[None for _ in range(N)] for _ in range(N)]  # 64x64 placement grid of tile_ids
unused_tiles = set(data.keys())  # tiles not yet placed

def edges_match(edge1, edge2):
    """Check if two edges match (ignoring None as wildcards)."""
    for a, b in zip(edge1, edge2):
        if a is not None and b is not None and a != b:
            return False
    return True

changed = True
iterations = 0
# We iterate until we cannot place any more tiles
while changed:
    changed = False
    iterations += 1
    # Loop over every position in the grid
    for r in range(N):
        for c in range(N):
            if placement[r][c] is not None:
                continue  # already have a tile here
            # Determine the required edge patterns from neighbors or borders
            required = {}  # e.g., {'top': edge_pattern, 'left': edge_pattern, ...}
            # Top neighbor or top border
            if r == 0:
                # Top edge of puzzle -> must be a border edge
                required['top'] = None  # indicate border needed (we'll check border flag instead of exact pattern)
            elif placement[r-1][c] is not None:
                # Must match bottom edge of the tile above
                neighbor_id = placement[r-1][c]
                required['top'] = edges[neighbor_id]['bottom']
            # Bottom neighbor or bottom border
            if r == N-1:
                required['bottom'] = None  # bottom border needed
            elif placement[r+1][c] is not None:
                neighbor_id = placement[r+1][c]
                required['bottom'] = edges[neighbor_id]['top']
            # Left neighbor or left border
            if c == 0:
                required['left'] = None  # left border needed
            elif placement[r][c-1] is not None:
                neighbor_id = placement[r][c-1]
                required['left'] = edges[neighbor_id]['right']
            # Right neighbor or right border
            if c == N-1:
                required['right'] = None  # right border needed
            elif placement[r][c+1] is not None:
                neighbor_id = placement[r][c+1]
                required['right'] = edges[neighbor_id]['left']

            if not required:
                # No constraints (no neighbors and not on border) – skip for now
                continue

            # Find all tiles that satisfy all current constraints
            possible_tiles = []
            for tile_id in list(unused_tiles):
                fits = True
                # Check each required edge constraint
                for side, pattern in required.items():
                    if pattern is None:
                        # This position is at the puzzle border on 'side' – tile must have a border edge there
                        if not border_flags[tile_id][side]:
                            fits = False
                            break
                    else:
                        # Neighbor constraint: tile's 'side' edge must match the given pattern
                        if not edges_match(edges[tile_id][side], pattern):
                            fits = False
                            break
                if not fits:
                    continue
                # Additionally, ensure the tile's own border edges don't conflict with position:
                # (If the tile has a border edge on a side that is NOT a puzzle border, it can't be placed here.)
                if (border_flags[tile_id]['top'] and r != 0):        # tile has top border but not top row
                    continue
                if (border_flags[tile_id]['bottom'] and r != N-1):   # bottom border but not bottom row
                    continue
                if (border_flags[tile_id]['left'] and c != 0):       # left border but not left col
                    continue
                if (border_flags[tile_id]['right'] and c != N-1):    # right border but not right col
                    continue
                possible_tiles.append(tile_id)
                if len(possible_tiles) > 1:
                    # More than one possible tile fits here – leave ambiguous for now
                    break
            # Place the tile if exactly one candidate fits
            if len(possible_tiles) == 1:
                tile_to_place = possible_tiles[0]
                placement[r][c] = tile_to_place
                unused_tiles.remove(tile_to_place)
                changed = True
    # Safety: break out if iterations seem excessive (to prevent infinite loop in pathological cases)
    if iterations > 1000:
        break

# At this point, `placement` contains placed tile IDs or None for empty spots.

# 4. Prepare color mapping for symbols
# Define distinct colors for the 12 piece codes:
cmap = plt.cm.get_cmap('Paired', 12)  # use a colormap with 12 distinct colors
symbol_colors = {
    'Qw': cmap(0),  # light blue
    'Qb': cmap(1),  # dark blue
    'Rw': cmap(2),  # light green
    'Rb': cmap(3),  # dark green
    'Kw': cmap(4),  # pink
    'Kb': cmap(5),  # red
    'Nw': cmap(6),  # light orange
    'Nb': cmap(7),  # orange
    'Bw': cmap(8),  # light purple
    'Bb': cmap(9),  # purple
    'Pw': cmap(10), # pale yellow
    'Pb': cmap(11)  # brown
}
# Add colors for empty and missing tiles
symbol_colors[None] = (0.85, 0.85, 0.85, 1.0)  # light gray for empty squares within a tile
symbol_colors['**'] = (0.5, 0.5, 0.5, 1.0)    # darker gray for an entirely missing tile

# 5. Render the final assembled grid
tile_size = 8  # each tile is 8x8
grid_size = N * tile_size  # 512 (in symbols)
# Create an image array (H x W x 3) for RGB colors
image = np.zeros((grid_size, grid_size, 3))
for r in range(N):
    for c in range(N):
        if placement[r][c] is None:
            # If no tile placed, fill the 8x8 block with the "missing tile" color
            color = symbol_colors['**'][:3]  # RGB (ignore alpha)
            image[r*tile_size:(r+1)*tile_size, c*tile_size:(c+1)*tile_size, :] = color
        else:
            tile_id = placement[r][c]
            tile_matrix = data[tile_id]['symbols']
            # Fill each cell of the tile with the corresponding color
            for i in range(tile_size):
                for j in range(tile_size):
                    symbol = tile_matrix[i][j]
                    color = symbol_colors[symbol][:3]  # RGB color tuple
                    image[r*tile_size + i, c*tile_size + j, :] = color

# assume `image` is your (512×512×3) NumPy array, and tile_size=8, grid_size=512

import json

# After you’ve built `placement` as a 64×64 list of IDs or None:

# 1) Build your 2D ID grid
id_grid = [
    [placement[r][c] for c in range(64)]
    for r in range(64)
]


rows = len(id_grid)
cols = len(id_grid[0])

def get_neighbors(i, j):
    directions = [(-1, 0), (1, 0), (0, -1), (0, 1)]  # Up, Down, Left, Right
    neighbors = []
    for di, dj in directions:
        ni, nj = i + di, j + dj
        if 0 <= ni < rows and 0 <= nj < cols:
            neighbors.append(id_grid[ni][nj])
    return neighbors

for i, row in enumerate(id_grid):
    for j, value in enumerate(row):
        if value is None:
            neighbors = get_neighbors(i, j)
            print(f"None found at ({i}, {j}) with neighbors: {neighbors}")

# 2) Dump *just* that 2D list
with open('../common/tile_id_grid.json', 'w') as f:
    json.dump([id_grid], f, indent=4)