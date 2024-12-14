def split_file_into_sections(input_file, num_files=7, num_sections=49):
    # Calculate lines per section
    with open(input_file, 'r') as f:
        total_lines = sum(1 for _ in f)
    lines_per_section = total_lines // num_sections

    # Prepare output files
    output_files = [open(f'output_part_{i+1}.xml', 'w') for i in range(num_files)]

    # Read and distribute lines
    with open(input_file, 'r') as f:
        for i, line in enumerate(f):
            section = i // lines_per_section
            file_index = section % num_files
            output_files[file_index].write(line)

    # Close all output files
    for file in output_files:
        file.close()

    print(f"Split complete. Created {num_files} files.")

# Usage
input_file_path = 'title21.xml'
split_file_into_sections(input_file_path)