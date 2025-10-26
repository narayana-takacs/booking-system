select "executionId", convert_from("data", 'UTF8') as payload from "execution_data" order by "executionId" desc limit 1;
